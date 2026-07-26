"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { CLIENT_STATUSES } from "@/lib/statuses";
import type { ClientStatus } from "@/lib/database.types";
import { siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  enumValue,
  optionalString,
  requiredEmail,
  requiredString,
  requiredUuid,
  toFormError,
} from "@/lib/validation";

const STATUS_VALUES = CLIENT_STATUSES.map((s) => s.value) as ClientStatus[];

function readClientFields(formData: FormData) {
  return {
    name: requiredString(formData, "name", "Name", 200),
    email: requiredEmail(formData, "email", "Email"),
    phone: optionalString(formData, "phone", 50),
    company: optionalString(formData, "company", 200),
    status: enumValue<ClientStatus>(formData, "status", STATUS_VALUES, "lead"),
    notes: optionalString(formData, "notes", 5000),
  };
}

/** Supabase reports a duplicate on the unique lower(email) index as 23505. */
function isDuplicateEmail(error: { code?: string } | null) {
  return error?.code === "23505";
}

export async function createClientAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  let clientId: string;
  try {
    const fields = readClientFields(formData);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("clients")
      .insert(fields)
      .select("id")
      .single();

    if (isDuplicateEmail(error)) {
      return { error: "A client with that email address already exists." };
    }
    if (error || !data) return { error: error?.message ?? "Could not save client." };
    clientId = data.id;
  } catch (error) {
    return { error: toFormError(error) };
  }

  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${clientId}`);
}

export async function updateClientAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  let clientId: string;
  try {
    clientId = requiredUuid(formData, "id", "Client");
    const fields = readClientFields(formData);
    const supabase = await createClient();
    const { error } = await supabase
      .from("clients")
      .update(fields)
      .eq("id", clientId);

    if (isDuplicateEmail(error)) {
      return { error: "Another client already uses that email address." };
    }
    if (error) return { error: error.message };
  } catch (error) {
    return { error: toFormError(error) };
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  redirect(`/admin/clients/${clientId}`);
}

export async function deleteClientAction(formData: FormData) {
  await requireAdmin();

  const clientId = requiredUuid(formData, "id", "Client");
  const supabase = await createClient();
  // Projects, tasks and invoices cascade from the FK definitions.
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}

/** Paginated scan — fine at studio scale, where the user table stays small. */
async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const perPage = 200;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email,
    );
    if (match) return match;
    if (data.users.length < perPage) break;
  }
  return null;
}

/**
 * Invites a client to the portal. The invite carries the role and client_id in
 * user metadata, which the handle_new_user trigger copies onto their profile —
 * that link is what every RLS policy keys off.
 */
export async function inviteClientAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  try {
    const clientId = requiredUuid(formData, "id", "Client");
    const supabase = await createClient();

    const { data: client, error: loadError } = await supabase
      .from("clients")
      .select("id, email, name")
      .eq("id", clientId)
      .maybeSingle();

    if (loadError) return { error: loadError.message };
    if (!client) return { error: "Client not found." };

    const admin = createAdminClient();
    const redirectTo = `${siteUrl()}/auth/callback?next=/set-password`;

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      client.email,
      {
        redirectTo,
        data: { role: "client", client_id: client.id, full_name: client.name },
      },
    );

    if (!inviteError) {
      revalidatePath(`/admin/clients/${clientId}`);
      return { message: `Invite sent to ${client.email}.` };
    }

    // Already has an account: link it to this client and send a reset link so
    // they can get back in, rather than failing the whole action.
    const existing = await findAuthUserByEmail(admin, client.email);
    if (!existing) return { error: inviteError.message };

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: existing.id,
          role: "client",
          client_id: client.id,
          full_name: client.name,
        },
        { onConflict: "id" },
      );

    if (profileError) return { error: profileError.message };

    await admin.auth.resetPasswordForEmail(client.email, { redirectTo });

    revalidatePath(`/admin/clients/${clientId}`);
    return {
      message: `${client.email} already had an account — it's now linked to this client and a sign-in link is on its way.`,
    };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

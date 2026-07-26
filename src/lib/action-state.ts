/**
 * Shared shape for `useActionState` server actions.
 *
 * Lives outside the "use server" files on purpose: those modules may only
 * export async functions, so a type declared (or re-exported) there breaks the
 * build.
 */
export interface ActionState {
  error?: string;
  message?: string;
}

export interface AuthFormState {
  error?: string;
}

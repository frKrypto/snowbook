import type { SVGProps } from "react";

/** Thin line icons, sized by the parent's font-size-independent classes. */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="3" y="3" width="7.5" height="8" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" />
    <rect x="3" y="14" width="7.5" height="7" rx="1.5" />
    <rect x="13.5" y="11" width="7.5" height="10" rx="1.5" />
  </Icon>
);

export const ClientsIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.25 3.25 0 0 1 0 5.6" />
    <path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 20" />
  </Icon>
);

export const ProjectsIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="m15 8.5 5.1-2.6a.8.8 0 0 1 1.2.7v10.8a.8.8 0 0 1-1.2.7L15 15.5" />
    <rect x="2.7" y="5.2" width="12.3" height="13.6" rx="2.2" />
  </Icon>
);

export const InvoicesIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M5 3.8h14v16.4l-2.8-1.6-2.8 1.6-2.8-1.6-2.8 1.6L5 20.2Z" />
    <path d="M9 8.5h6M9 12.5h6" />
  </Icon>
);

export const PlusIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const CheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Icon>
);

export const TrashIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4 6.5h16M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7" />
    <path d="M6.5 6.5 7.4 20a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9l.9-13.5" />
  </Icon>
);

export const ArrowLeftIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);

export const MailIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2.2" />
    <path d="m3.8 6.8 7.3 5.3a1.5 1.5 0 0 0 1.8 0l7.3-5.3" />
  </Icon>
);

export const DownloadIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4.5 18.5h15" />
  </Icon>
);

export const UploadIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 19V8M7.5 12.5 12 8l4.5 4.5" />
    <path d="M4.5 5h15" />
  </Icon>
);

export const FileIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M13.5 3.5H7a1.8 1.8 0 0 0-1.8 1.8v13.4A1.8 1.8 0 0 0 7 20.5h10a1.8 1.8 0 0 0 1.8-1.8V8.8Z" />
    <path d="M13.5 3.5v4.2a1 1 0 0 0 1 1h4.3" />
  </Icon>
);

export const SignOutIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M15 4.8h3.2a1.8 1.8 0 0 1 1.8 1.8v10.8a1.8 1.8 0 0 1-1.8 1.8H15" />
    <path d="M10 8.5 6.5 12 10 15.5M6.5 12H15" />
  </Icon>
);

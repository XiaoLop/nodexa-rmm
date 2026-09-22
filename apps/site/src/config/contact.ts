export type ContactInfo = {
  email?: string;
  telegram?: string;
  wechat?: string;
};

function readPublicEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function getContactInfo(): ContactInfo {
  return {
    email: readPublicEnv("NEXT_PUBLIC_CONTACT_EMAIL"),
    telegram: readPublicEnv("NEXT_PUBLIC_CONTACT_TELEGRAM"),
    wechat: readPublicEnv("NEXT_PUBLIC_CONTACT_WECHAT"),
  };
}
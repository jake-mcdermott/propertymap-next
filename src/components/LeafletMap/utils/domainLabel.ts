export function domainLabel(href?: string) {
    if (!href) return null;
    try {
      const host = new URL(href).host.replace(/^www\./, "");
      if (host.includes("myhome")) return "MyHome";
      if (host.includes("propertymap")) return "PropertyMap";
      if (host.includes("findqo")) return "FindQo";
      if (host.includes("sherryfitz")) return "SherryFitz";
      if (host.includes("dng")) return "DNG";
      if (host.includes("westcorkproperty")) return "James Lyon O'Keefe";
      if (host.includes("michelleburke")) return "Michelle Burke";
      return host.split(".")[0];
    } catch { return null; }
  }
  
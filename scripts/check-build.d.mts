import type { BuildTarget } from "./content-config.ts";

export function appendLicenseNotices(source: string, notices: string): string;
export function checkBuilds(targets?: BuildTarget[]): Promise<void>;

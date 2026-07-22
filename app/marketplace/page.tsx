import type { Metadata } from "next";import { MarketplaceBrowser } from "@/components/processforge/marketplace-browser";
export const metadata:Metadata={title:"SOP Template Marketplace | ProcessForge AI",description:"Discover reusable, quality-scored SOP templates for operational teams.",alternates:{canonical:"/marketplace"},openGraph:{title:"ProcessForge SOP Template Marketplace",description:"Discover reusable, quality-scored SOP templates.",type:"website"}};
export default function MarketplacePage(){return <MarketplaceBrowser/>}

import { connectorRegistry } from "@/lib/integrations/connectors/connector-registry";
import { whatsAppConnector } from "./whatsapp-connector";

export * from "./whatsapp-types";
export * from "./whatsapp-connector";

// Register WhatsApp Cloud API connector into the global connector registry
connectorRegistry.register(whatsAppConnector);

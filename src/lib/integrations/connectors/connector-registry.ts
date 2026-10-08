import {
  IntegrationConnector,
} from "@/lib/types/connector";
import { IntegrationCapability } from "@/lib/types/integrations";

import { whatsAppConnector } from "@/lib/connectors/whatsapp/whatsapp-connector";

/**
 * In-memory registry for provider connector implementations.
 * Connectors register at runtime or application boot.
 */
class ConnectorRegistry {
  private connectors = new Map<string, IntegrationConnector>();

  constructor() {
    this.register(whatsAppConnector);
  }

  /**
   * Registers a connector adapter for a specific provider key.
   */
  public register(connector: IntegrationConnector): void {
    if (!connector.providerKey) {
      throw new Error("Connector must specify a valid providerKey.");
    }
    this.connectors.set(connector.providerKey, connector);
  }

  /**
   * Unregisters a connector by provider key.
   */
  public unregister(providerKey: string): boolean {
    return this.connectors.delete(providerKey);
  }

  /**
   * Resolves a connector implementation for a provider key.
   */
  public get(providerKey: string): IntegrationConnector | undefined {
    if (!this.connectors.has(providerKey) && providerKey === "whatsapp") {
      this.register(whatsAppConnector);
    }
    return this.connectors.get(providerKey);
  }

  /**
   * Checks whether a connector is registered for a provider key.
   */
  public has(providerKey: string): boolean {
    if (!this.connectors.has(providerKey) && providerKey === "whatsapp") {
      this.register(whatsAppConnector);
    }
    return this.connectors.has(providerKey);
  }

  /**
   * Lists all registered connectors.
   */
  public list(): IntegrationConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Validates if a registered connector supports a given capability.
   */
  public supportsCapability(
    providerKey: string,
    capability: IntegrationCapability
  ): boolean {
    const connector = this.connectors.get(providerKey);
    if (!connector) return false;
    return connector.capabilities.includes(capability);
  }

  /**
   * Clears all registered connectors (primarily for testing isolation).
   */
  public clear(): void {
    this.connectors.clear();
  }
}

export const connectorRegistry = new ConnectorRegistry();

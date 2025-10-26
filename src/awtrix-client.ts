import type { AwtrixMessage } from "./types";

export class AwtrixClient {
  private baseUrl: string;
  private appName = "onair";

  constructor(host: string) {
    this.baseUrl = `http://${host}`;
  }

  async updateCustomApp(data: AwtrixMessage | null): Promise<void> {
    try {
      if (data === null) {
        const url = `${this.baseUrl}/api/custom/${this.appName}`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          throw new Error(`Awtrix API error: ${response.status} ${response.statusText}`);
        }
      } else {
        const url = `${this.baseUrl}/api/custom?name=${this.appName}`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error(`Awtrix API error: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error("Failed to update Awtrix custom app:", error);
      throw error;
    }
  }

  async showOnAir(): Promise<void> {
    await this.updateCustomApp({
      text: "ON AIR",
      color: "#FF0000",
      icon: "7956",
    });
  }

  async hideOnAir(): Promise<void> {
    await this.updateCustomApp(null);
  }
}

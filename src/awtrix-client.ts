import type { AwtrixMessage } from "./types";

export class AwtrixClient {
  private baseUrl: string;
  private appName = "onair";

  constructor(host: string) {
    this.baseUrl = `http://${host}`;
  }

  async updateCustomApp(data: AwtrixMessage | null): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/custom?name=${this.appName}`;
      const payload = data === null ? {} : data;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Awtrix API error: ${response.status} ${response.statusText}`);
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

  async getApps(): Promise<Array<{ name: string }>> {
    try {
      const url = `${this.baseUrl}/api/apps`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Awtrix API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as Array<{ name: string }>;
    } catch (error) {
      console.error("Failed to get Awtrix apps:", error);
      throw error;
    }
  }

  async ensureCleanState(): Promise<void> {
    const apps = await this.getApps();
    if (apps.some((app) => app.name === this.appName)) {
      console.log(`Clearing existing "${this.appName}" app state`);
      await this.hideOnAir();
    }
  }
}

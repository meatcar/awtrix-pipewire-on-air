import type { AwtrixMessage } from "./types";

const APP_NAME = "onair";

/**
 * Client for controlling an Awtrix LED matrix display.
 *
 * Provides methods to show/hide an "ON AIR" indicator by managing
 * a custom app on the Awtrix device.
 *
 * @see https://blueforcer.github.io/awtrix3/#/api
 */
export class AwtrixClient {
  private baseUrl: string;
  private appName = APP_NAME;
  private onAirText: string;
  private onAirColor: string;
  private onAirIcon: string;

  /**
   * Creates a new Awtrix client.
   *
   * @param host The Awtrix display host (IP:port or hostname:port)
   * @param onAirText The text to display when microphone is active
   * @param onAirColor The color of the text when microphone is active
   * @param onAirIcon The icon to display when microphone is active
   */
  constructor(
    host: string,
    onAirText = "ON AIR",
    onAirColor = "#FF0000",
    onAirIcon = "liveonair",
  ) {
    this.baseUrl = `http://${host}`;
    this.onAirText = onAirText;
    this.onAirColor = onAirColor;
    this.onAirIcon = onAirIcon;
  }

  /**
   * Updates or removes the custom "ON AIR" app on the display.
   *
   * @param data The message to display, or null to remove the app
   * @throws Error if the API request fails
   */
  private async updateCustomApp(data: AwtrixMessage | null): Promise<void> {
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
      throw new Error(
        `\x1b[31mAwtrix API error: ${response.status} ${response.statusText}\x1b[0m`,
      );
    }
  }

  /**
   * Shows the "ON AIR" indicator on the display.
   */
  async showOnAir(): Promise<void> {
    await this.updateCustomApp({
      text: this.onAirText,
      color: this.onAirColor,
      icon: this.onAirIcon,
    });
  }

  /**
   * Hides the "ON AIR" indicator from the display.
   */
  async hideOnAir(): Promise<void> {
    await this.updateCustomApp(null);
  }

  /**
   * Retrieves the list of active apps on the display.
   *
   * @returns Array of app objects with name properties
   * @throws Error if the API request fails
   */
  private async getApps(): Promise<Array<{ name: string }>> {
    const url = `${this.baseUrl}/api/apps`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `\\x1b[31mAwtrix API error: ${response.status} ${response.statusText}\\x1b[0m`,
      );
    }

    return (await response.json()) as Array<{ name: string }>;
  }

  /**
   * Ensures the display starts in a clean state.
   *
   * Removes any existing "ON AIR" app that might be left over from
   * a previous session.
   */
  async ensureCleanState(): Promise<void> {
    const apps = await this.getApps();
    if (apps.some((app) => app.name === this.appName)) {
      console.log(
        `\x1b[33m[Awtrix] Clearing existing "${this.appName}" app state\x1b[0m`,
      );
      await this.hideOnAir();
    }
  }
}

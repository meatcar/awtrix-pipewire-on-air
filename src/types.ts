/**
 * Message configuration for an Awtrix custom app.
 *
 * @see https://blueforcer.github.io/awtrix3/#/api?id=custom-apps-and-notifications
 */
export interface AwtrixMessage {
	/** The text to display on the matrix */
	text: string;
	/** Icon name or ID from the Awtrix icon database */
	icon?: string;
	/** Display duration in seconds (0 = permanent until removed) */
	duration?: number;
	/** Brightness level (0-255) */
	brightness?: number;
	/** Text color in hex format (e.g., "#FF0000") */
	color?: string;
	/** Progress bar value (0-100) */
	progress?: number;
	/** Progress bar color in hex format */
	progressColor?: string;
}

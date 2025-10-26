export interface NiriWindow {
  id: number;
  title: string;
  app_id: string;
  pid: number;
  workspace_id: number;
  is_focused: boolean;
  is_floating: boolean;
  is_urgent: boolean;
}

export interface WindowOpenedOrChanged {
  WindowOpenedOrChanged: {
    window: NiriWindow;
  };
}

export type NiriEvent = WindowOpenedOrChanged | Record<string, unknown>;

export interface AwtrixMessage {
  text: string;
  icon?: string;
  duration?: number;
  brightness?: number;
  color?: string;
  progress?: number;
  progressColor?: string;
}

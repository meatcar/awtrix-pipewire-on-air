import { describe, test, expect, mock } from "bun:test";
import { PipeWireMonitor } from "../src/pipewire-monitor";

/**
 * Unit tests for PipeWireMonitor state tracking logic.
 *
 * These tests validate the complex state management given that pw-dump --monitor
 * sends PARTIAL/DELTA batches, not full snapshots. A stream can be active but
 * absent from subsequent array dumps.
 */

describe("PipeWireMonitor", () => {
  describe("Array handling (partial/delta batches)", () => {
    test("should add mic stream when it appears in array", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      // Simulate array dump with a mic stream
      const arrayDump = [
        {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "TestApp",
            },
          },
        },
      ];

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(arrayDump);

      expect(onMicChanged).toHaveBeenCalledWith(true, "TestApp");
    });

    test("should NOT remove mic stream when absent from partial array", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      // First array: mic stream present
      const arrayDump1 = [
        {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "TestApp",
            },
          },
        },
      ];

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(arrayDump1);
      expect(onMicChanged).toHaveBeenCalledWith(true, "TestApp");
      onMicChanged.mockClear();

      // Second array: mic stream ABSENT (partial batch)
      // This simulates pw-dump sending a partial batch that doesn't include our stream
      const arrayDump2 = [
        {
          id: 999,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Output/Audio",
            },
          },
        },
      ];

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(arrayDump2);

      // Mic should STILL be active (absence doesn't mean removal)
      expect(onMicChanged).not.toHaveBeenCalled();
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.has(123)).toBe(true);
    });

    test("should remove mic stream when it appears with different media.class in array", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      // First array: mic stream present
      const arrayDump1 = [
        {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "TestApp",
            },
          },
        },
      ];

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(arrayDump1);
      expect(onMicChanged).toHaveBeenCalledWith(true, "TestApp");
      onMicChanged.mockClear();

      // Second array: SAME stream ID but different class (class changed)
      const arrayDump2 = [
        {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Output/Audio", // Changed from Input to Output
              "application.name": "TestApp",
            },
          },
        },
      ];

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(arrayDump2);

      // Stream should be removed (class changed)
      expect(onMicChanged).toHaveBeenCalledWith(false);
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.has(123)).toBe(false);
    });

    test("BUG: should remove mic stream when it appears with undefined media.class in array", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      // First array: mic stream present
      const arrayDump1 = [
        {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "TestApp",
            },
          },
        },
      ];

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(arrayDump1);
      expect(onMicChanged).toHaveBeenCalledWith(true, "TestApp");
      onMicChanged.mockClear();

      // Second array: SAME stream ID but media.class is now undefined
      // This could happen if the stream is shutting down or properties are being cleared
      const arrayDump2 = [
        {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              // media.class is undefined/missing
              "application.name": "TestApp",
            },
          },
        },
      ];

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(arrayDump2);

      // Stream should be removed (no longer a mic stream)
      // Currently FAILS due to bug on line 196 of pipewire-monitor.ts
      expect(onMicChanged).toHaveBeenCalledWith(false);
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.has(123)).toBe(false);
    });
  });

  describe("Event handling", () => {
    test("should add mic stream on 'added' event", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      const addedEvent = {
        type: "added",
        object: {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "TestApp",
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(addedEvent);

      expect(onMicChanged).toHaveBeenCalledWith(true, "TestApp");
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.has(123)).toBe(true);
    });

    test("should remove mic stream on 'removed' event", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      // First add a stream
      const addedEvent = {
        type: "added",
        object: {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "TestApp",
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(addedEvent);
      onMicChanged.mockClear();

      // Now remove it
      const removedEvent = {
        type: "removed",
        id: 123,
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(removedEvent);

      expect(onMicChanged).toHaveBeenCalledWith(false);
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.has(123)).toBe(false);
    });

    test("should remove mic stream when 'changed' event shows class change", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      // First add a stream
      const addedEvent = {
        type: "added",
        object: {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "TestApp",
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(addedEvent);
      onMicChanged.mockClear();

      // Now change it to non-mic class
      const changedEvent = {
        type: "changed",
        object: {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Output/Audio", // Changed
              "application.name": "TestApp",
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(changedEvent);

      expect(onMicChanged).toHaveBeenCalledWith(false);
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.has(123)).toBe(false);
    });

    test("should keep mic stream when 'changed' event updates properties but class remains mic", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      // First add a stream
      const addedEvent = {
        type: "added",
        object: {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "TestApp",
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(addedEvent);
      onMicChanged.mockClear();

      // Change app name but keep mic class
      const changedEvent = {
        type: "changed",
        object: {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio", // Still a mic
              "application.name": "UpdatedApp", // Changed name
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(changedEvent);

      // Should NOT trigger callback (state didn't change from active to inactive)
      expect(onMicChanged).not.toHaveBeenCalled();
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.has(123)).toBe(true);
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.get(123)).toBe("UpdatedApp");
    });
  });

  describe("Multiple streams", () => {
    test("should track multiple mic streams simultaneously", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      // Add first stream
      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage({
        type: "added",
        object: {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "App1",
            },
          },
        },
      });
      expect(onMicChanged).toHaveBeenCalledWith(true, "App1");
      onMicChanged.mockClear();

      // Add second stream (mic still active, just different app)
      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage({
        type: "added",
        object: {
          id: 456,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "App2",
            },
          },
        },
      });
      // Should NOT call callback (already active)
      expect(onMicChanged).not.toHaveBeenCalled();
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.size).toBe(2);

      // Remove first stream
      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage({
        type: "removed",
        id: 123,
      });
      // Should NOT call callback (still have second stream)
      expect(onMicChanged).not.toHaveBeenCalled();
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.size).toBe(1);

      // Remove second stream
      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage({
        type: "removed",
        id: 456,
      });
      // NOW should call callback (no more active streams)
      expect(onMicChanged).toHaveBeenCalledWith(false);
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.size).toBe(0);
    });
  });

  describe("Application filtering", () => {
    test("should exclude streams from excluded applications", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, ["vivaldi"], false);

      const vivaldiEvent = {
        type: "added" as const,
        object: {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "Vivaldi input",
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(vivaldiEvent);

      // Should NOT trigger callback for excluded application
      expect(onMicChanged).not.toHaveBeenCalled();
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.has(123)).toBe(false);
    });

    test("should allow streams from non-excluded applications", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      const discordEvent = {
        type: "added" as const,
        object: {
          id: 456,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "Discord",
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(discordEvent);

      // Should trigger callback for non-excluded application
      expect(onMicChanged).toHaveBeenCalledWith(true, "Discord");
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.has(456)).toBe(true);
    });

    test("should handle case-insensitive matching", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, ["chrome"], false);

      const chromeEvent = {
        type: "added" as const,
        object: {
          id: 789,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "CHROME", // uppercase
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(chromeEvent);

      // Should NOT trigger callback for excluded application (case-insensitive)
      expect(onMicChanged).not.toHaveBeenCalled();
    });

    test("should handle partial name matches", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, ["firefox"], false);

      const firefoxEvent = {
        type: "added" as const,
        object: {
          id: 101,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "Firefox Browser", // contains "firefox"
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(firefoxEvent);

      // Should NOT trigger callback for excluded application (partial match)
      expect(onMicChanged).not.toHaveBeenCalled();
    });

    test("should exclude applications matching keywords", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, ["browser"], false);

      const browserEvent = {
        type: "added" as const,
        object: {
          id: 202,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "Some Web Browser", // contains "web" and "browser" keywords
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(browserEvent);

      // Should NOT trigger callback for excluded application (keyword match)
      expect(onMicChanged).not.toHaveBeenCalled();
    });

    test("should exclude cava audio visualizer", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, ["cava"], false);

      const cavaEvent = {
        type: "added" as const,
        object: {
          id: 303,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "cava", // exact match in excluded list
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(cavaEvent);

      // Should NOT trigger callback for excluded application
      expect(onMicChanged).not.toHaveBeenCalled();
    });

    test("should exclude applications from CLI ignore-apps option", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(
        onMicChanged,
        ["CustomApp", "Another"],
        false,
      );

      const customEvent = {
        type: "added" as const,
        object: {
          id: 404,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "application.name": "CustomApp",
            },
          },
        },
      };

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage(customEvent);

      // Should NOT trigger callback for CLI-excluded application
      expect(onMicChanged).not.toHaveBeenCalled();
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.has(404)).toBe(false);
    });
  });

  describe("Edge cases", () => {
    test("should ignore non-mic streams", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage({
        type: "added",
        object: {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Output/Audio", // Output, not Input
              "application.name": "Speaker",
            },
          },
        },
      });

      expect(onMicChanged).not.toHaveBeenCalled();
      // @ts-expect-error - accessing private field for testing
      expect(monitor.activeMicStreams.has(123)).toBe(false);
    });

    test("should handle malformed messages gracefully", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      // Completely malformed
      // @ts-expect-error - accessing private method for testing
      expect(() => monitor.handleMessage(null)).not.toThrow();
      // @ts-expect-error - accessing private method for testing
      expect(() => monitor.handleMessage(undefined)).not.toThrow();
      // @ts-expect-error - accessing private method for testing
      expect(() => monitor.handleMessage("string")).not.toThrow();

      expect(onMicChanged).not.toHaveBeenCalled();
    });

    test("should use fallback app name when application.name is missing", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage({
        type: "added",
        object: {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              "node.name": "FallbackName",
              // application.name is missing
            },
          },
        },
      });

      expect(onMicChanged).toHaveBeenCalledWith(true, "FallbackName");
    });

    test("should use 'Unknown' when both application.name and node.name are missing", () => {
      const onMicChanged = mock(() => {});
      const monitor = new PipeWireMonitor(onMicChanged, [], false);

      // @ts-expect-error - accessing private method for testing
      monitor.handleMessage({
        type: "added",
        object: {
          id: 123,
          type: "PipeWire:Interface:Node",
          info: {
            props: {
              "media.class": "Stream/Input/Audio",
              // Both names missing
            },
          },
        },
      });

      expect(onMicChanged).toHaveBeenCalledWith(true, "Unknown");
    });
  });
});

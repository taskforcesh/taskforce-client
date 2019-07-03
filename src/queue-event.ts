import { EventEmitter } from "events";

import { Job } from "./job";
import { MessageBroker } from "@taskforcesh/message-broker";
import { Command, CommandTypes, SendEvent } from "@taskforcesh/queue-commands";
import { Events } from "@taskforcesh/queue-commands/dist/queue-events";

export class QueueEvent<K> {
  private events: Set<keyof Events>;
  eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.events = new Set();
  }

  protected async registerEvent(
    mb: MessageBroker<Command>,
    event: keyof Events
  ) {
    if (!this.events.has(event)) {
      this.events.add(event);
      return mb.sendData<void>({
        type: CommandTypes.RegisterEvent,
        payload: { event }
      });
    }
  }

  protected async unregisterEvent(
    mb: MessageBroker<Command>,
    event: keyof Events
  ) {
    if (this.events.has(event)) {
      this.events.delete(event);
      return mb.sendData<void>({
        type: CommandTypes.UnregisterEvent,
        payload: { event }
      });
    }
  }

  protected processEvent(cmd: Command) {
    if (cmd.type === CommandTypes.SendEvent) {
      const payload = (<SendEvent>cmd).payload;
      const args = [payload.event, ...payload.data];
      this.eventEmitter.emit.apply(this.eventEmitter, args);
    }
  }
}

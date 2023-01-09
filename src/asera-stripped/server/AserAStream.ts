"use strict";
import AserAMessage from "./AserAMessage";
import { message } from "./AserAMessage";

import {
  Payload,
  StreamDef,
  StreamConfig,
  LOGLEVELS,
  AseraStreamEntity,
  AseraStreamDoc
} from "./types";

type OperatorEmit = {
  streamIdentifier: string;
  emit: string;
};

type OperatorCommand = {
  aseraServer: string;
  type: string;
  payload: Payload;
};

import { Transform as Stream } from "stream";


import {
  ts,
  aItem as AserAItem,
  aId as AserAId,
  yCatch,
  keepForRetry,
  createAck,
  aseraLogger,
  ack
} from "./AserAHelpers";

var totalMessagesWritten: number = 0;
var totalMessagesRead: number = 0;

import { endianness } from "os";

class AserAStream extends Stream {
  this!: Object;
  streamDef: StreamDef;
  streamDoc: string;
  streamClass: AserAStream;
  inputConfig: StreamConfig;
  outputStream: AserAStream;
  catchError: Function;
  keepForRetry: Function;
  log: {
    info: Function;
    error: Function;
    warn: Function;
    trace: Function;
    debug: Function;
  };
  createAck: Function;
  ack: Function;
  documentation: {};
  streamIdentifier: string;
  streamId: string;
  config: { [key: string]: any };
  typeStates: { [key: string]: any };
  streams: { [key: string]: AserAStream };
  converterStream: AserAStream | null;
  createMessage: (x0: { message_data: any; payload: Payload }) => AserAMessage;

  log_to_console: boolean
  datact: number;
  totalct: number;
  lastct: number;
  started: boolean;
  startedTs: string;
  stoppedTs: string;
  startStopHistory: [any?];
  typeCt: { [key: string]: any };
  statistics: { [key: string]: any };
  // TODO: Added field based on usage
  errors?: number;
  totalerrors: number;
  initiated: boolean;
  streamMessagesWritten: number;
  streamMessagesRead: number;
  asyncEvents: { [key: string]: any };

  constructor(
    streamDef: StreamDef,
    outputStream: AserAStream,
    motherId: string
  ) {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    });
    this.log_to_console = false;
    this.streamDef = streamDef;
    this.streamDoc = JSON.stringify(streamDef, null, "\t");
    this.streamClass = streamDef.streamClass;
    this.inputConfig = streamDef.streamConfig;
    this.outputStream = outputStream;
    this.catchError = yCatch.bind(this);
    this.keepForRetry = keepForRetry.bind(this);
    this.createAck = createAck.bind(this);
    this.ack = ack.bind(this);
    this.log = {
      info: aseraLogger.info.bind(this),
      warn: aseraLogger.warn.bind(this),
      error: aseraLogger.error.bind(this),
      debug: aseraLogger.debug.bind(this),
      trace: aseraLogger.trace.bind(this)
    };
    this.documentation = {};
    this.streamIdentifier = "";
    if (motherId != null) {
      this.streamIdentifier = motherId + "_" + this.streamDef.streamId;
    } else {
      this.streamIdentifier = this.streamDef.streamId;
    }
    this.asyncEvents = {};
    this.streamId = this.streamDef.streamId;
    this.config = this.setStates(this.inputConfig);

    if (this.config.log === undefined) {
      if (outputStream) {
        this.config.log = outputStream.getLog();
      } else {
        this.config.log = LOGLEVELS.warn;
      }
    }
    if (this.config.version === undefined) {
      if (outputStream) {
        this.config.version = outputStream.getVersion();
      } else {
        this.config.version = "undefined";
      }
    }

    this.typeStates = {};
    this.streams = this.setStreams(streamDef.streamConfig.streams);
    this.converterStream = null;

    if (this.config.converterStream) {
      this.converterStream = new this.config.converterStream.streamClass(
        this.config.converterStream,
        outputStream,
        this.streamId
      );
    } // createMessage = function (type, payload, msgId)

    // $FlowFixMe

    this.createMessage = message({
      creator: this.streamIdentifier
    });
    this.log.info("StreamId: " + this.streamId);
    /* Statistics parameters */

    this.datact = 0;
    this.totalct = 0;
    this.lastct = 0;
    this.started = false;
    this.startedTs = "";
    this.stoppedTs = "";
    this.startStopHistory = [];
    this.typeCt = {};
    this.statistics = {};
    this.totalerrors = 0;
    this.streamMessagesWritten = 0;
    this.streamMessagesRead = 0;
    this.initiated = false;

    const _this = this;

    this.on("checkForOperatorCommand", function (msg: AserAMessage) {
      try {
        if (
          msg.type() === "asera.operator.sendStatus" ||
          msg.type() === "asera.operator.shutdownAll"
        ) {
          let newmsg = msg.createMessageWithThisAsMother(
            _this.createMessage({
              message_data: {
                type: "asera.operator.system.status"
              },
              payload: _this.getStatus()
            })
          );
          newmsg.identity_data.identity = _this.config.systemIdentifier;

          _this.writeMessage(newmsg);
        }

        if (
          msg.type() === "asera.operator.createDocumentation"
        ) {
          _this.log.info("emitting create doc");
          _this.emit("createDocumentation", msg);
        } else if (
          msg.type() === "asera.operator.shutdownAll"
        ) {
          _this.shutDownAll(_this);
        } else if (msg.type() === "asera.operator.emit") {
          let pl = <OperatorEmit>msg.message_payload();
          _this.log.info("emit " + pl.streamIdentifier);

          let str = _this.getStream(pl.streamIdentifier);

          if (str) {
            str.emit(pl.emit);
          } else {
            _this.log.info("stream not found");
          }
        } else if (msg.type() === "asera.operator.command") {
          let pl = <OperatorCommand>msg.message_payload();
          _this.log.info(
            "Operator command " +
            pl.aseraServer +
            " / " +
            _this.streamIdentifier
          );
          if (
            pl.aseraServer !== "All" &&
            pl.aseraServer !== _this.streamIdentifier
          ) {
            return;
          }
          _this.log.info({
            msg: "Operator command to be executed",
            operatormsg: msg
          });

          _this.writeMessage(
            msg.createMessageWithThisAsMother(
              _this.createMessage({
                message_data: {
                  type: pl.type
                },
                payload: pl.payload
              })
            )
          );
        } else {
          _this.log.error(`message type not found ${msg.type()}`);
        }
      } catch (error) {
        _this.catchError({
          error: error,
          msg: msg
        });
      }
    });
    this.on("updateStreamStates", function (streamsAndStates: [AserAStream]) {
      _this.updateStreamStates(streamsAndStates);
    });
    this.on("addParameters", function (msg: any) { });
    this.on("requestAppShutdown", function (msg: any) {
      _this.shutDownAll(_this);
    });
    this.on("start", function (msg: any) {
      // constructor calls set started at end
    });
    this.on("data", function (msg: AserAMessage) {
      /* TODO update statistics */
      try {
        totalMessagesRead += 1;
        _this.streamMessagesRead += 1;
        _this.datact += 1;
        _this.lastct += 1;
        _this.totalct += 1;
        if (_this.config.log === LOGLEVELS.trace) {
          _this.log.info("START " + msg.type());
        }
      } catch (error) {
        _this.catchError({
          error: error,
          msg: msg
        });
      }
    });
    this.on("error", function (error: any) {
      /* update statistics */
      _this.catchError({
        error: error
      });
    });
  }

  updateStreamStates(streamsAndStates: [AserAStream]) {
    streamsAndStates.forEach(stream => {
      if (stream.streamIdentifier === this.streamIdentifier) {
        var stateIds = Object.keys(stream.config);
        stateIds.forEach((state: string) => {
          this.config[state] = stream.config[state];
        });
      }
    });
    for (const key in this.streams) {
      this.streams[key].updateStreamStates(streamsAndStates);
    }
  }

  getStreamStates(streamIdentifier: string): any {
    if (streamIdentifier === this.streamIdentifier) {
      return this.config;
    } else if (this.streams !== null) {
      for (const key in this.streams) {
        let st = this.streams[key].getStreamStates(streamIdentifier);
        if (st) return st;
      }
    } else {
      return null;
    }
  }

  getStream(streamIdentifier: string): AserAStream | null {
    if (streamIdentifier === this.streamIdentifier) {
      return this;
    } else if (this.streams !== null) {
      for (const key in this.streams) {
        let st = this.streams[key].getStream(streamIdentifier);
        if (st) return st;
      }
    } else {
      return null;
    }
    return null;
  }

  getDocumentationSkeleton(type: string): AseraStreamDoc {
    return {
      entity: {
        id: this.streamId,
        type: "StreamDef",
        border: false
      },
      stream: {
        entity: {
          id: this.streamId,
          type: type,
          border: true,
          mouseOver:
            JSON.stringify(this.statistics, null, "\t") +
            (this.outputStream !== null ? this.streamDoc + "\t" : "\t")
        }
      },
      sources: [],
      sinks: [],
      links: []
    };
  }

  createDocumentEntity(
    type: string,
    id: string,
    border: boolean
  ): AseraStreamEntity {
    return {
      entity: {
        id: id,
        type: type,
        border: border
      }
    };
  }

  createDocumentation(connectTo: string | undefined | null): AseraStreamDoc {
    let streamDoc = this.getDocumentationSkeleton("Stream");
    this.createDocumentationConnections(streamDoc);
    streamDoc.links.push(
      this.createDocumentEntity("Link", connectTo || "", true)
    );
    return streamDoc;
  }

  createDocumentationConnections(streamDoc: AseraStreamDoc) { }

  getLog(): number {
    return this.config.log || LOGLEVELS.info;
  }

  getVersion(): string {
    return this.config.version;
  }

  setStarted() {
    if (this.initiated) {
      this.started = true;
      this.startedTs = ts();
      this.startTimers();
    }
  }

  getStarted() {
    return this.started;
  }

  getInitiated() {
    return () => {
      return this.initiated === true;
    };
  }

  setStoppped() {
    this.started = false;
    this.stoppedTs = ts();
    this.startStopHistory.push({
      start: this.startedTs,
      stop: this.stoppedTs,
      count: this.datact,
      totalCt: this.totalct
    });
  }

  startTimers() {
    if (this.config.timers) {
      let _this = this;

      this.config.timers.forEach(function (timer: any) {
        _this.log.info("start timer for emitting " + timer.emitId);
        timer.timerprocess = setInterval(() => {
          _this.emit(timer.emitId);
        }, timer.ms);
      });
    }
  }

  stopTimers() {
    if (this.config.timers) {
      this.config.timers.forEach(function (timer: any) {
        clearInterval(timer.timerprocess);
      });
    }
  }

  getStatus() {
    let statArr: Array<any> = [];
    this.pushStat(statArr, this);
    return statArr;
  }

  pushStat(statArr: Array<any>, stream: AserAStream) {
    let lastctr = stream.lastct;
    if (this.config.log >= LOGLEVELS.trace) {
      stream.log.debug("statistics for ".concat(stream.streamIdentifier));
    }
    statArr.push(
      AserAItem({
        itemType: "yourstatistics",
        id: stream.streamIdentifier,
        payload: stream.streamStatistics(stream),
        version: -1,
        owner: this.config.systemIdentifier
      })
    );
    stream.lastct = 0;

    for (const key in stream.streams) {
      this.pushStat(statArr, stream.streams[key]);
    }
  }

  extraStatistics(): any {
    if (this.outputStream === null) {
      return {
        totalMessagesWritten: totalMessagesWritten,
        totalMessagesRead: totalMessagesRead
      };
    } else return {};
  }

  streamStatistics(stream: AserAStream) {
    let lastctr = stream.lastct;
    stream.statistics = {
      streamId: stream.streamIdentifier,
      streamClass: stream.streamClass,
      statistics: {
        inErrorMode: stream.config.inError,
        started: stream.started,
        startedTime: stream.started ? stream.startedTs : null,
        currentCt: stream.datact,
        sincelast: lastctr,
        totalCt: stream.totalct,
        history: stream.startStopHistory,
        type: stream.typeCt,
        total_errors: stream.totalerrors,
        errors: stream.errors,
        streamMessagesWritten: stream.streamMessagesWritten,
        streamMessagesRead: stream.streamMessagesRead,
        extra: stream.extraStatistics()
      }
    };
    return stream.statistics;
  }

  shutDownAll(stream: AserAStream) {
    /* eslint-disable no-unused-vars */
    this.log.info(
      this.streamIdentifier + " shutdown. First call for close adapters"
    );
    for (const key in stream.streams) {
      stream.streams[key].emit("shutdown");
    }
    setTimeout(() => {
      for (const key in stream.streams) {
        stream.streams[key].emit("shutdownFinal");
      }
      this.log.info(
        this.streamIdentifier +
        " sleep for additional 15 more sec and then exit"
      );
      setTimeout(function () {
        process.exit(12);
      }, 15000);
    }, 15000);
  }

  accumulateOnMsgType(msgT: string) {
    if (!this.typeCt[msgT]) {
      this.typeCt[msgT] = 0;
    }

    this.typeCt[msgT] += 1;
  }

  generateStream(streamDef: StreamDef): AserAStream {
    const s = streamDef.streamClass;
    // @ts-ignore
    return new s(streamDef, this, this.streamIdentifier);
  }

  setStreams(strs: Array<StreamDef>): {} {
    var streams: { [key: string]: AserAStream } = {};

    if (strs) {
      strs.map((stream, j) => {
        streams[stream.streamId] = this.generateStream(stream);
      });
    }

    return streams;
  }

  setStates(istates: {
    [key: string]: any;
  }): {
    [key: string]: any;
  } {
    // go through keys, if keys = map with function, read source and create function
    if (!istates) return {};
    var stateIds = Object.keys(istates);
    var states: { [key: string]: any } = {};
    stateIds.forEach(function (state: string) {
      var val = istates[state];
      states[state] = val;
    });
    return states;
  }

  getStreamId() {
    return this.streamId;
  }

  writeToStream(msg: any, type?: string): string {
    var id = AserAId();

    if (msg instanceof AserAMessage) {
      this.outputStream.writeMessage(msg)
    } else if (this.converterStream) {
      this.converterStream.writeMessage(
        this.createMessage({
          message_data: {
            type: type
              ? type
              : this.config.type
                ? this.config.type
                : "nomsgtype",
            message_id: id
          },
          payload: msg
        })
      );
    } else if (this.config.raw) {
      this.outputStream.writeMessage(
        this.createMessage({
          message_data: {
            type: type
              ? type
              : this.config.type
                ? this.config.type
                : "nomsgtype",
            message_id: id
          },
          payload: this.config.toStringFormat
            ? msg.toString(this.config.toStringFormat)
            : msg.toString()
        })
      );
    } else {
      this.outputStream.writeMessage(
         new AserAMessage(
            JSON.parse(msg.toString()),
            type
              ? type
              : this.config.settype
                ? this.config.type
                : null
          )
      );
    }

    return id;
  }

  writeMessage(msg: AserAMessage) {
    // $FlowFixMe
    totalMessagesWritten += 1;
    this.streamMessagesWritten += 1;
    this.write(msg);
  }

  setTypeStates(
    type: string,
    typeStates: {
      [key: string]: any;
    }
  ) {
    const _this = this;

    if (!this.typeStates[type]) {
      this.typeStates[type] = new Map();
    }

    Object.keys(typeStates).forEach(function (mtname: string) {
      _this.typeStates[type][mtname] = typeStates[mtname];
    });
  }

  getMsgTypeStateValue(
    type: string | null,
    stateVar: string,
    usetype: string | null = null
  ): string {
    if (type && this.typeStates[type]) {
      if (this.typeStates[type][stateVar]) {
        return this.typeStates[type][stateVar];
      }
    }

    return this.config[stateVar]
      ? this.config[stateVar]
      : usetype || "asera.messagetype.notdefined";
  }
} // $FlowFixMe

Stream.prototype._transform = function (
  data: any,
  encoding: any,
  callback: any
) {
  this.push(data);
  callback();
};

export default AserAStream;
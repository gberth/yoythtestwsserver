"use strict";

import { StreamDef, LOGLEVELS, AseraStreamDoc, RequestType } from "./types";
import AserAMessage from "./AserAMessage";
import AserAStream from "./AserAStream";

import { aItem as AserAItem } from "./AserAHelpers";

type MsgMap = { [key: string]: MsgMap | Array<AserAStream> };
type MsgTypeStream = {
  type: string;
  streams: Array<AserAStream>;
};
type DispatcherMessage = {
  type: string;
  typeStates: {
    returnMessageType: string;
    errorMessageType: string;
  };
  streams: [
    {
      streamId: string;
      typeStates?: {
        [key: string]: any;
      };
    }
  ];
};

import _ from "lodash";

class AserADispatcher extends AserAStream {
  dispatch: Function;
  writeDefault: boolean;
  messageToStream: { [key: string]: AserAStream[] | null };
  msgMap: { [key: string]: any };

  constructor(
    streamDef: StreamDef,
    outputStream: AserAStream,
    motherId: string
  ) {
    super(streamDef, outputStream, motherId);
    this.writeDefault = this.config.writeDefault || false;
    this.messageToStream = {}; // map for resolved messages

    this.msgMap = {};

    const _this = this;

    this.dispatch = this.setDispatcher(
      (_this.config.dispatcherMessages as DispatcherMessage[]).map(disp => ({
        type: disp.type,
        streams: disp.streams.map(str => {
          if (!_this.streams[str.streamId]) {
            _this.log.info("Dispatch to stream " + str.streamId + " not found");
            setTimeout(function () {
              process.exit(12);
            }, 5000);
          }

          if (str.typeStates) {
            _this.streams[str.streamId].setTypeStates(
              disp.type,
              str.typeStates
            );
          }

          return _this.streams[str.streamId];
        })
      }))
    ); // TODO return error = _this.disptach not function, otherwise oper message

    this.on("data", function (msg: AserAMessage) {
      try {
        if (_this.config.log === LOGLEVELS.trace) {
          _this.log.info(
            "Dispatch " +
            _this.streamIdentifier +
            " " +
            msg.message_data.type
          );
        }
        _this.accumulateOnMsgType(msg.message_data.type);

        _this.dispatch(msg);
      } catch (error) {
        _this.catchError({
          error: error,
          msg: msg
        });
      }
    });
    this.on("config", function (msg: AserAMessage) { });
    this.on("createDocumentation", function (msg: AserAMessage) {
      if (
        msg &&
        msg.message_data.type === "asera.operator.createDocumentation"
      ) {
        let doc = _this.createServerDocumentation();
        // AserACalculateStreamLayout(doc.streamDoc);
        _this.writeMessage(
          msg.createMessageWithThisAsMother(
            _this.createMessage({
              message_data: {
                type: "asera.operator.server.documentation"
              },
              payload: [
                AserAItem({
                  itemType: "yourdocumentation",
                  id: _this.streamIdentifier,
                  payload: doc,
                  version: -1
                })
              ]
            })
          )
        );
      }
    });
    this.on("notHandled", function (msg: AserAMessage) {
      _this.log.info({ txt: "ikke behandlet ennå ", msg: msg });
    });
    this.initiated = true;
    this.setStarted();
  }

  createServerDocumentation(): { streamDoc: AseraStreamDoc[] } {
    let streamDoc = [this.getDocumentationSkeleton("Dispatcher")];

    if (this.streams !== null) {
      for (const key in this.streams) {
        streamDoc.push(
          this.streams[key].createDocumentation(this.streamIdentifier)
        );
      }
    }
    return {
      streamDoc
    };
  }

  private setDispatcher(dispatchMsgs: Array<MsgTypeStream>) {
    const _this = this;

    const buildMap = function (msgEl: string, mapEl: MsgMap): MsgMap {
      if (!mapEl[msgEl]) {
        mapEl[msgEl] = {};
      }

      return <MsgMap>mapEl[msgEl];
    };

    dispatchMsgs.map(function (dispatchMsg: MsgTypeStream) {
      var lookInMap: MsgMap = _this.msgMap;
      let m = dispatchMsg.type.split(".");
      m.map(function (el: string, i) {
        lookInMap = buildMap(el, lookInMap);
      });

      if (lookInMap.streams) {
        _this.log.info(
          "Already defined streams for messagetype: ".concat(
            dispatchMsg.type
          )
        );
        process.exit(12);
      }

      lookInMap.streams = dispatchMsg.streams;
    });
    return function (msg: AserAMessage) {
      function getStreams(
        sMap: MsgMap,
        msgt: Array<string>
      ): Array<AserAStream> | null {
        let el1 = msgt.shift();
        if (!el1) return null;
        var ret = null;
        let entry = <MsgMap>sMap[el1];
        let entryall = <MsgMap>sMap["*"];
        // if only both msg.value and msgt.* return concat of streams
        if (entry && entry.streams && msgt.length === 0) {
          if (entryall && (entryall as MsgMap).streams) {
            return (<Array<AserAStream>>entry.streams).concat(
              <Array<AserAStream>>(entryall as MsgMap).streams
            );
          } else {
            return <Array<AserAStream>>entry.streams;
          }
        }
        // if only msgtype and xxxx.* defined - accept xxxx
        if (
          entry &&
          msgt.length === 0 &&
          entry["*"] &&
          (entry["*"] as MsgMap).streams
        ) {
          return <Array<AserAStream>>(entry["*"] as MsgMap).streams;
        }

        if (entry) {
          ret = getStreams(entry, msgt);
        }

        if (!ret && entry && entry["*"] && el1 !== "operator") {
          ret = getStreams(<MsgMap>entry["*"], msgt);
        }

        if (!ret) {
          let anymsg = <MsgMap>sMap["*"];
          if (anymsg && anymsg.streams && el1 !== "operator") {
            return <Array<AserAStream>>anymsg.streams;
          }
        }

        return ret;
      }
      if (msg.type() === RequestType.ACK) {
        if (msg.get_request_stream()) {
          let str = _this.streams[msg.get_request_stream()]
          if (str) {
            str.writeMessage(msg)
            return
          }
          _this.log.error("ACK without known stream " + msg.type());
          return
        }
      }
      if (msg.type() && !_this.messageToStream[msg.type()]) {
        const msgEl = msg.type().split(".");
        _this.messageToStream[msg.type()] = getStreams(
          _this.msgMap,
          msgEl
        );
      }

      var strs = _this.messageToStream[msg.type()];

      if (strs) {
        strs.map(function (str: AserAStream) {
          str.writeMessage(msg);
        });
      } else {
        if (_this.writeDefault) {
          _this.log.info("writeDefault");

          _this.outputStream.writeMessage(msg);
        } else {
          _this.emit("checkForOperatorCommand", msg);
        }
      }
    };
  }
}

export default AserADispatcher;

import { StreamClasses } from "./index";
import AserAStream from "./server/AserAStream";
import { setLogOveride } from "./server/AserAHelpers";

import convict from "convict";
import merge from "merge";

export type StartParameters = {
  aseraDefinition: any;
  businessStreams?: any;
  serverId?: string;
  testStreams?: any;
  version?: string;
  log?: any;
};

export const start = function ({
  aseraDefinition,
  businessStreams,
  serverId,
  testStreams,
  version,
  log
}: StartParameters): AserAStream {
  const findStream = (classString: string) => {
    if (businessStreams && businessStreams[classString]) {
      return businessStreams[classString];
    }
    // @ts-ignore
    else if (StreamClasses[classString]) {
      // @ts-ignore
      return StreamClasses[classString];
    } else if (testStreams && testStreams[classString]) {
      return testStreams[classString];
    } else {
      console.log("Abort: Class not found", classString);
      process.exit(12);
    }
  };
  const setStream = (stream: any) => {
    stream.streamClassId = stream.streamClassId || stream.streamClass;
    stream.streamClass = findStream(stream.streamClassId);
    if (stream.streamConfig.converterStream) {
      stream.streamConfig.converterStreamId =
        stream.streamConfig.converterStream;
      stream.streamConfig.converterStream = findStream(
        stream.streamConfig.converterStream.streamClass
      );
    }
    if (stream.streamConfig.streams) {
      stream.streamConfig.streams.map((streamDef: any, j: number) => {
        setStream(streamDef);
      });
    }
  };

  setStream(aseraDefinition.stream);

  if (serverId) {
    aseraDefinition.stream.streamId = serverId;
  }
  if (version) {
    aseraDefinition.stream.streamConfig.version = version;
  }

  if (log) {
    // initiate log - set log function to helpers
    setLogOveride(log);
  }

  return new aseraDefinition.stream.streamClass(
    aseraDefinition.stream,
    null,
    null
  );
};

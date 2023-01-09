/* jshint node: true, strict: true */

import convict from "convict";
import pckage from "../../package.json";

// Configuration schema

const conf = convict({
  env: {
    doc: "Applicaton environments",
    format: ["development", "production", "test"],
    default: "development",
    env: "NODE_ENV",
    arg: "env"
  },

  version: {
    doc: "Version of the application",
    format: String,
    default: pckage.version
  },

  name: {
    doc: "Name of the application",
    format: String,
    default: "Asera",
    env: "ASERAAPPL"
  },

  aseraconfig: {
    doc: "Stream Config file",
    format: String,
    default: "",
    env: "ASERACONFIG"
  },

  aseraappstreams: {
    doc: "Asera Application stream",
    default: "",
    format: String,
    env: "APPSTREAMS"
  },
});

// Validate all properties and export it
conf.validate();

export default conf;

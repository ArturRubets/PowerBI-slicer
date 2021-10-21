"use strict";

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class VisualSettings extends DataViewObjectsParser {
  public settings: Settings = new Settings();
}

export class Settings {
  // Text Size
  public data: {
    fontSize: number,
    order: boolean
  }

  public appearance:{
    blackMode: boolean
  }
}


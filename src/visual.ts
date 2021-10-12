"use strict";
import {
    select as d3Select
} from "d3-selection";
import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import PrimitiveValue = powerbi.PrimitiveValue;
import { VisualSettings } from "./settings";
import { dataViewObjects } from "powerbi-visuals-utils-dataviewutils";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
type Selection<T1, T2 = T1> = d3.Selection<any, T1, any, T2>;
import * as d3 from "d3";
import IVisualEventService = powerbi.extensibility.IVisualEventService;


interface Settings {
    data: {
        fill: string;
        fontSize: number;
    };
    topic: {
        hide: boolean;
        fontSize: number;
        text: string;
    }
}

interface Data {
    data: PrimitiveValue[];
}

interface ViewModel {
    dataModel: Data;
    settings: Settings;
}

let defaultSettings: Settings = {
    data: {
        fill: '#4762D3',
        fontSize: 15
    },
    topic: {
        fontSize: 15,
        hide: false,
        text: null
    }
};

function visualTransform(options: VisualUpdateOptions): ViewModel {
    let dataViews = options.dataViews;
    let viewModel: ViewModel = {
        dataModel: null,
        settings: <Settings>{}
    };

    if (!dataViews
        || !dataViews[0]
        || !dataViews[0].categorical
        || !dataViews[0].categorical.categories
        || !dataViews[0].categorical.categories[0].source
        || !dataViews[0].categorical.categories[0].values
    ) {
        return viewModel;
    }

    let categorical = dataViews[0].categorical;

    let categories = categorical.categories[0]

    let objects = dataViews[0].metadata.objects;


    let settings: Settings = {
        data: {
            fill: dataViewObjects.getFillColor(objects, { objectName: 'data', propertyName: 'fill' }, defaultSettings.data.fill),
            fontSize: dataViewObjects.getValue(objects, { objectName: "data", propertyName: "fontSize",
            }, defaultSettings.data.fontSize),
        },
        topic:{
            text: dataViewObjects.getValue(objects, { objectName: "topic", propertyName: "text"}, categories.source.displayName),
            fontSize: dataViewObjects.getValue(objects, { objectName: "topic", propertyName: "fontSize"}, defaultSettings.topic.fontSize),
            hide: dataViewObjects.getValue(objects, { objectName: "topic", propertyName: "hide"}, defaultSettings.topic.hide),
        }
    };


    let data: Data = { data: categories.values};
    
    return {
        dataModel: data,
        settings: settings
    };
}




export class Visual implements IVisual {
    private settings: Settings
    private svg: Selection<any>;
    private container: Selection<any>;
    private dataModel: Data;
    private host: IVisualHost;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.svg = d3Select(options.element)
            .append('svg')
        this.container = this.svg.append('g')
    }

    public update(options: VisualUpdateOptions) {
        let viewModel: ViewModel = visualTransform(options);
        this.settings = viewModel.settings;
        this.dataModel = viewModel.dataModel;
        console.log(viewModel);
        
        let width = options.viewport.width;
        let height = options.viewport.height;
        this.svg.attr("width", width).attr("height", height);

        let margin = Math.min(width, height) * 0.1
        this.container
            .attr("transform", "translate(" + margin + "," +  margin + ")")

        this.container
            .append('ellipse')
            .attr('cx', 100)
            .attr('cy', 100)
            .attr('rx', 200)
            .attr('ry', 100)

    }





    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): powerbi.VisualObjectInstanceEnumeration {
        let objectName = options.objectName;
        let objectEnumeration: VisualObjectInstance[] = [];

        if (!this.settings ||
            !this.settings.data ||
            !this.settings.topic) {
            return objectEnumeration;
        }

        switch (objectName) {
            case 'topic':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        hide: this.settings.topic.hide,
                        fontSize: this.settings.topic.fontSize,
                        text: this.settings.topic.text
                    },
                    validValues: {
                        fontSize: {
                            numberRange: {
                                min: 6,
                                max: 40
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'data':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        fill: this.settings.data.fill,
                        fontSize: this.settings.data.fontSize,
                    },
                    validValues: {
                        fontSize: {
                            numberRange: {
                                min: 6,
                                max: 40
                            }
                        }
                    },
                    selector: null
                });
                break;
        };
        return objectEnumeration;
    }

}
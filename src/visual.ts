"use strict";
import { select as d3Select } from "d3-selection";
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
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;


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
    data: PrimitiveValue
    selectionId: ISelectionId
}

interface ViewModel {
    dataModel: Data[];
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

export class Visual implements IVisual {
    private selectionManager: ISelectionManager;
    private settings: Settings
    private svg: Selection<any>;
    private container: Selection<any>;
    private rect: Selection<any>;
    private text: Selection<any>;
    private dataModel: Data[];
    private host: IVisualHost;
    private margin: number
    private widthRect: number
    private heightRect: number
    private width: number;
    private height: number;
    private quantityElements: number = 1

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = options.host.createSelectionManager()
        this.svg = d3Select(options.element).append('svg')
        this.container = this.svg.append('g').attr('class', 'shadow')
        this.rect = this.container.append('rect')
        this.text = this.container.append('text')
    }

    public update(options: VisualUpdateOptions) {
        let viewModel: ViewModel = visualTransform(options, this.host);
        this.settings = viewModel.settings;
        this.dataModel = viewModel.dataModel;
        this.width = options.viewport.width;
        this.height = options.viewport.height;
        this.svg.attr("width", this.width).attr("height", this.height);

        this.margin = Math.min(this.width, this.height) * 0.1
        this.widthRect = this.width - this.margin * 2
        this.heightRect = this.height - this.margin * 2
        this.container.attr("transform", "translate(" + this.margin + "," + this.margin + ")")

        this.rect
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.widthRect)
            .attr('height', this.heightRect)
            .attr('rx', this.widthRect * 0.09)
            .style('fill', '#fff')

        this.text
            .attr('x', this.widthRect / 2)
            .attr('y', this.heightRect / 2)
            .style('font-size', Math.min(this.widthRect, this.heightRect) * 0.4)
            .attr('alignment-baseline', 'middle')
            .attr('text-anchor', 'middle')
            .text(this.dataModel[0].data.toString())


        this.selectionManager
            .select(this.dataModel[0].selectionId)
            .then((ids: ISelectionId[]) => {
                console.log((ids));
                
            });
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

function visualTransform(options: VisualUpdateOptions, host: IVisualHost): ViewModel {
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
            fontSize: dataViewObjects.getValue(objects, {
                objectName: "data", propertyName: "fontSize",
            }, defaultSettings.data.fontSize),
        },
        topic: {
            text: dataViewObjects.getValue(objects, { objectName: "topic", propertyName: "text" }, categories.source.displayName),
            fontSize: dataViewObjects.getValue(objects, { objectName: "topic", propertyName: "fontSize" }, defaultSettings.topic.fontSize),
            hide: dataViewObjects.getValue(objects, { objectName: "topic", propertyName: "hide" }, defaultSettings.topic.hide),
        }
    };


    let data: Data[] = []
    categories.values.forEach((d, i) => data.push({
        data: d, 
        selectionId: host.createSelectionIdBuilder().withCategory(categories, i)
            .createSelectionId()
    }))

    return {
        dataModel: data,
        settings: settings
    };
}
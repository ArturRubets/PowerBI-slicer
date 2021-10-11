"use strict";

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

interface Settings {
    general: {
        fill: string;
        fontSize: number;
    };
    title: {
        hide: boolean;
        fontSizeTitle: number;
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
    general: {
        fill: '#4762D3',
        fontSize: 15
    },
    title: {
        fontSizeTitle: 15,
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
        general: {
            fill: dataViewObjects.getFillColor(objects, { objectName: 'general', propertyName: 'fill' }, defaultSettings.general.fill),
            fontSize: dataViewObjects.getValue(objects, { objectName: "general", propertyName: "fontSize",
            }, defaultSettings.general.fontSize),
        },
        title:{
            text: dataViewObjects.getValue(objects, { objectName: "general", propertyName: "text"}, categories.source.displayName),
            fontSizeTitle: dataViewObjects.getValue(objects, { objectName: "general", propertyName: "fontSizeTitle"}, defaultSettings.title.fontSizeTitle),
            hide: dataViewObjects.getValue(objects, { objectName: "general", propertyName: "hide"}, defaultSettings.title.hide),
        }
    };


    let data: Data = { data: categories.values};
    
    return {
        dataModel: data,
        settings: settings
    };
}




export class Visual implements IVisual {
    private target: HTMLElement;
    private updateCount: number;
    private settings: Settings;
    private textNode: Text;
    
    
    private dataModel: Data;
    private host: IVisualHost;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;



        console.log('Visual constructor', options);
        this.target = options.element;
        this.updateCount = 0;
        if (document) {
            const new_p: HTMLElement = document.createElement("p");
            new_p.appendChild(document.createTextNode("Update count:"));
            const new_em: HTMLElement = document.createElement("em");
            this.textNode = document.createTextNode(this.updateCount.toString());
            new_em.appendChild(this.textNode);
            new_p.appendChild(new_em);
            this.target.appendChild(new_p);
        }
    }

    public update(options: VisualUpdateOptions) {
        let viewModel: ViewModel = visualTransform(options);
        this.settings = viewModel.settings;
        this.dataModel = viewModel.dataModel;
        console.log(viewModel);
        
        
        //this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
        console.log('Visual update', options);
        if (this.textNode) {
            this.textNode.textContent = (this.updateCount++).toString();
        }

        const div: HTMLElement = document.createElement("div");
        div.style.width = '20px';
        div.style.height = '20px';
        div.style.backgroundColor = '#CCC';
        div.innerText = "DIV"
        this.target.appendChild(div)


    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): powerbi.VisualObjectInstanceEnumeration {
        let objectName = options.objectName;
        let objectEnumeration: VisualObjectInstance[] = [];

        if (!this.settings ||
            !this.settings.general ||
            !this.settings.title) {
            return objectEnumeration;
        }

        switch (objectName) {
            case 'title':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        hide: this.settings.title.hide,
                        fontSizeTitle: this.settings.title.fontSizeTitle,
                        text: this.settings.title.text
                    },
                    validValues: {
                        fontSizeTitle: {
                            numberRange: {
                                min: 6,
                                max: 40
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'general':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        fill: this.settings.general.fill,
                        fontSize: this.settings.general.fontSize,
                    },
                    validValues: {
                        fontSizeValue: {
                            numberRange: {
                                min: 0,
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
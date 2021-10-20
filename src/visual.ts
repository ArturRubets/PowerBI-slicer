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
import PrimitiveValue = powerbi.PrimitiveValue;
import { Settings } from "./settings";
import { dataViewObjects } from "powerbi-visuals-utils-dataviewutils";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
type Selection<T1, T2 = T1> = d3.Selection<any, T1, any, T2>;
import * as d3 from "d3";
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import {BasicFilter, IFilterColumnTarget} from 'powerbi-models'

const defaultSettings: Settings = {
    data: {
        fontSize: null
    },
    appearance: {
        blackMode: false
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

export class Visual implements IVisual {
    private events: IVisualEventService;
    private selectionManager: ISelectionManager;
    private settings: Settings
    private svg: Selection<any>;
    private container: Selection<any>;
    private rect: Selection<any>;
    private text: Selection<any>;
    private dataModel: Data[];
    private host: IVisualHost;
    private marginVertical: number
    private marginHorizontal: number
    private widthRect: number
    private heightRect: number
    private width: number;
    private height: number;
    private options: VisualUpdateOptions

    private shiftRight: boolean = false
    private shiftLeft: boolean = false
    private arrowLeft: Selection<any>
    private arrowRight: Selection<any>
    private rectForClickArrowLeft: Selection<any>
    private rectForClickArrowRight: Selection<any>
    private containerArrowLeft: Selection<any>
    private containerArrowRight: Selection<any>
    private duration: number = 400
    private isEventUpdate: boolean = false
    private defaultValue: string = '(Empty)'

    private selectionIds: ISelectionId[] = [];
    private activeData: Data

    constructor(options: VisualConstructorOptions) {
        this.events = options.host.eventService;
        this.host = options.host;
        this.selectionManager = options.host.createSelectionManager()
        this.selectionManager.registerOnSelectCallback((ids: ISelectionId[]) => {
            // console.log(ids);
            // this.options.jsonFilters
            // this.applyFilter()

        });
        this.svg = d3Select(options.element).append('svg')
        this.container = this.svg.append('g').attr('class', 'shadow')
        this.rect = this.container.append('rect')
        this.text = this.container.append('text')

        this.containerArrowLeft = this.container.append('g')
        this.containerArrowRight = this.container.append('g')

        this.rectForClickArrowLeft = this.containerArrowLeft.append('rect')
        this.rectForClickArrowRight = this.containerArrowRight.append('rect')

        this.arrowLeft = this.containerArrowLeft.append('path').attr('stroke-linecap', 'round')
        this.arrowRight = this.containerArrowRight.append('path').attr('stroke-linecap', 'round')
    }

    public update(options: VisualUpdateOptions) {
        this.events.renderingStarted(options);
        this.options = options
        
        let viewModel: ViewModel = visualTransform(options, this.host);

        this.settings = viewModel.settings;
        this.dataModel = viewModel.dataModel;
        this.setActiveData(this.dataModel)


        this.width = options.viewport.width;
        this.height = options.viewport.height;
        this.svg.attr("width", this.width).attr("height", this.height);
        this.marginVertical = Math.min(this.width, this.height) * 0.1
        this.marginHorizontal = Math.min(this.width, this.height) * 0.5
        const widthRect = this.widthRect = this.width - this.marginHorizontal * 2
        this.heightRect = this.height - this.marginVertical * 2

        this.setShiftVisual()
        const black = '#333', white = '#fff'
        const fillText = this.settings.appearance.blackMode ? white : black
        const fillButton = this.settings.appearance.blackMode ? black : white

        this.drawButton(fillButton)
        this.drawText(fillText)
        const distanceUntilRect = this.marginHorizontal / 1.1
        const marginUntilRect = distanceUntilRect * 0.2
        const actualWidth = distanceUntilRect - marginUntilRect
        const height = this.heightRect / 3
        const strokeWidth = 0.6//actualWidth * 0.03
        const settings = { distanceUntilRect, marginUntilRect, actualWidth, height, widthRect, strokeWidth }
        this.drawArrowLeft(settings)
        this.drawArrowRight(settings)
        this.clickArrowLeftEvent()
        this.clickArrowRightEvent()

        // if (!this.isEventUpdate) {
        //     this.applyFilter()
        // }
        debugger

        let target: IFilterColumnTarget = {
            table: "Analyze ( Chart1)",
            column: "Qty"
        };
        let values = [1, 2, 3, 23, 24];
        let filter: BasicFilter = new BasicFilter(target, "In", values)
        
       this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge);
 

    }

    private applyFilter() {
        if (this.host.hostCapabilities.allowInteractions) {
            this.isEventUpdate = true; // This is checked in the update method. If true it won't re-render, this prevents and infinite loop
            this.selectionManager.clear(); // Clean up previous filter before applying another one.     
            this.selectionIds.push(this.activeData.selectionId)
            this.selectionIds = [this.selectionIds[this.selectionIds.length - 1]]
            this.selectionManager.select(this.selectionIds, true)
        }
    }

    private clickArrowLeftEvent() {
        this.rectForClickArrowLeft.on('click', d => {
            if (this.host.hostCapabilities.allowInteractions) {
                this.shiftLeft = true
                this.rectForClickArrowLeft.on('click', null)
                this.animateOpacity(this.rectForClickArrowLeft.node())
            }
        })
    }

    private clickArrowRightEvent() {
        this.containerArrowRight.on('click', d => {
            if (this.host.hostCapabilities.allowInteractions) {
                this.shiftRight = true
                this.containerArrowRight.on('click', null)
                this.animateOpacity(this.rectForClickArrowRight.node())
            }
        })
    }

    private checkOneObjectInDataModel(dataModel: Data[]) {
        return dataModel.length === 1
    }

    private checkEmptyDataModel(dataModel: Data[]) {
        return dataModel.length === 0
    }

    private existActiveData() {
        return this.activeData && this.activeData.data != this.defaultValue
    }

    private existActiveDataInDataModel() {
        //проверка нужна для того чтобы сразу переключить активный элемент при смене набора данных. Например при смене года на месяц
        const index = this.findIndexData(this.activeData)

        return index != -1
    }

    private setActiveData(dataModel: Data[]) {

        if (this.checkEmptyDataModel(dataModel)) {
            this.activeData = { data: this.defaultValue, selectionId: null }
            this.disableArrow(this.containerArrowLeft)
            this.disableArrow(this.containerArrowRight)
            return
        }

        if (this.checkOneObjectInDataModel(dataModel)) {
            this.activeData = dataModel[0]
            this.disableArrow(this.containerArrowLeft)
            this.disableArrow(this.containerArrowRight)
            return
        }

        if (!this.existActiveData()) {
            this.activeData = dataModel[0]
        } else if (!this.existActiveDataInDataModel()) {
            this.activeData = dataModel[0]
        }
        else {
            const dataIndex = this.findIndexData(this.activeData)
            if (this.shiftLeft) {
                this.activeData = dataModel[Math.max(dataIndex - 1, 0)]
            } else if (this.shiftRight) {
                this.activeData = dataModel[Math.min(dataIndex + 1, dataModel.length - 1)]
            }
        }


        const dataIndexAfterChange = this.findIndexData(this.activeData)

        if (dataIndexAfterChange === 0) {
            this.disableArrow(this.containerArrowLeft)
            this.ableArrow(this.containerArrowRight)
        }
        else if (dataIndexAfterChange === dataModel.length - 1) {
            this.disableArrow(this.containerArrowRight)
            this.ableArrow(this.containerArrowLeft)
        }
        else {
            this.ableArrow(this.containerArrowRight)
            this.ableArrow(this.containerArrowLeft)
        }

        this.shiftRight = this.shiftLeft = false
    }

    private findIndexData(data) {
        return this.dataModel.findIndex(d => d.selectionId.equals(data.selectionId) && d.data === data.data)
    }

    private disableArrow(arrowContainer) {
        arrowContainer.style('display', 'none')
    }

    private ableArrow(arrowContainer) {
        arrowContainer.style('display', 'inline')
    }

    private setShiftVisual() {
        this.container.attr("transform", "translate(" + this.marginHorizontal + "," + this.marginVertical + ")")
    }

    private drawButton(fill) {
        if (this.widthRect / this.heightRect > 0.2) {
            this.rect
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', this.widthRect)
                .attr('height', this.heightRect)
                .attr('rx', this.widthRect * 0.09)
                .style('fill', fill)
        } else {
            this.rect
                .attr('width', 0)
                .attr('height', 0)
        }

    }

    private drawText(fill) {
        const fontSize = this.settings.data.fontSize ? this.settings.data.fontSize : Math.min(this.widthRect, this.heightRect) * 0.4
        this.text
            .attr('x', this.widthRect / 2)
            .attr('y', this.heightRect / 2)
            .style('font-size', fontSize)
            .attr('alignment-baseline', 'middle')
            .attr('text-anchor', 'middle')
            .style('fill', fill)
            .text(this.activeData.data.toString())
    }

    private drawArrowLeft({ actualWidth, height, distanceUntilRect, strokeWidth }) {
        const startX = -distanceUntilRect
        const startY = this.heightRect / 2

        this.containerArrowLeft.attr('transform', `translate(${startX}, ${startY})`)

        this.arrowLeft
            .attr('d', `
                    M 0 0
                    l ${actualWidth} ${height}
                    M 0 0
                    l ${actualWidth} ${-height}
                `)
            .style('stroke', '#000')
            .style('stroke-width', strokeWidth)

        const nodeArrow = this.arrowLeft.node().getBBox()

        //Прямоугольник отрисовуется по размерам стрелки для того чтобы проще было кликать на стрелку
        this.rectForClickArrowLeft
            .attr('x', 0)
            .attr('y', -nodeArrow.height / 2)
            .attr('width', nodeArrow.width)
            .attr('height', nodeArrow.height)
            .style('fill-opacity', 0)
    }

    private drawArrowRight({ distanceUntilRect, actualWidth, height, widthRect, strokeWidth }) {
        const startX = distanceUntilRect + widthRect
        const startY = this.heightRect / 2

        this.containerArrowRight.attr('transform', `translate(${startX}, ${startY})`)

        this.arrowRight
            .attr('d', `
                M 0 0
                l ${-actualWidth} ${height}
                M 0 0
                l ${-actualWidth} ${-height}
            `)
            .style('stroke', '#000')
            .style('stroke-width', strokeWidth)


        const nodeArrow = this.arrowRight.node().getBBox()

        //Прямоугольник отрисовуется по размерам стрелки для того чтобы проще было кликать на стрелку
        this.rectForClickArrowRight
            .attr('x', -nodeArrow.width)
            .attr('y', -nodeArrow.height / 2)
            .attr('width', nodeArrow.width)
            .attr('height', nodeArrow.height)
            .style('fill-opacity', 0)
    }

    private executeAfterAnimate() {
        this.update(this.options)
        this.applyFilter()
        this.events.renderingFinished(this.options);
    }

    private animateOpacity(node) {
        d3.select(node)
            .style('fill', 'black')
            .style('fill-opacity', 0.4)
            .transition()
            .duration(this.duration)
            .style('fill-opacity', 0)
            .end()
            .then(() => {
                this.executeAfterAnimate()
            })
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): powerbi.VisualObjectInstanceEnumeration {
        let objectName = options.objectName;
        let objectEnumeration: VisualObjectInstance[] = [];

        if (!this.settings ||
            !this.settings.data) {
            return objectEnumeration;
        }

        switch (objectName) {
            case 'data':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        fontSize: this.settings.data.fontSize,
                    },
                    selector: null
                });
                break;
            case 'appearance':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        blackMode: this.settings.appearance.blackMode,
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
            fontSize: dataViewObjects.getValue(objects, { objectName: "data", propertyName: "fontSize" },
                defaultSettings.data.fontSize),
        },
        appearance: {
            blackMode: dataViewObjects.getValue(objects, { objectName: "appearance", propertyName: "blackMode" },
                defaultSettings.appearance.blackMode),
        }
    };


    let data: Data[] = []
    categories.values.forEach((d, i) => data.push({
        data: d,
        selectionId: host.createSelectionIdBuilder()
            .withCategory(categories, i)
            .createSelectionId()
    }))

    return {
        dataModel: data,
        settings: settings
    };
}
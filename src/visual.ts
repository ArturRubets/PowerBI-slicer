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
import ISelectionId = powerbi.visuals.ISelectionId;
import * as pbm from 'powerbi-models'
import { interactivityFilterService } from "powerbi-visuals-utils-interactivityutils";

const defaultSettings: Settings = {
    data: {
        fontSize: null,
        mode: true,
        dblClick: false
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
    private containerRect: Selection<any>
    private containerArrowLeft: Selection<any>
    private containerArrowRight: Selection<any>
    private duration: number = 400
    private activeData: Data
    private dateModelOrderFlag: boolean
    private dataModelPrev: Data[] = []
    private defaultValue = '(Empty)'

    private get colors() {
        return {
            black: '#333',
            white: '#fff'
        }
    }

    constructor(options: VisualConstructorOptions) {
        this.events = options.host.eventService;
        this.host = options.host;

        this.svg = <any>d3Select(options.element).append('svg')
        this.container = this.svg.append('g').attr('class', 'shadow')

        this.containerArrowLeft = this.container.append('g')
        this.containerArrowRight = this.container.append('g')
        this.containerRect = this.container.append('g')

        this.rect = this.containerRect.append('rect')
        this.text = this.containerRect.append('text')

        this.rectForClickArrowLeft = this.containerArrowLeft.append('rect')
        this.rectForClickArrowRight = this.containerArrowRight.append('rect')

        this.arrowLeft = this.containerArrowLeft.append('path').attr('stroke-linecap', 'round')
        this.arrowRight = this.containerArrowRight.append('path').attr('stroke-linecap', 'round')
    }


    public update(options: VisualUpdateOptions) {
        this.events.renderingStarted(options);
        this.options = options
        const viewModel: ViewModel = visualTransform(options, this.host, this.defaultValue)
        this.settings = viewModel.settings
        this.dataModel = viewModel.dataModel
        if (!this.settings || !this.dataModel) {
            return
        }

        if (this.changeDataModel()) {
            this.setDataInitial(this.dataModel, this.settings.data.mode)
            this.applyFilter()
        }

        if (this.checkToggleOrderData(this.settings.data.mode)) {
            this.setDataWhenToggleOrderData(this.dataModel, this.settings.data.mode)
            this.changeOrderData(this.settings.data.mode)
            this.applyFilter()
        }
        this.supportBookmarksAndFiltersOnReport()

        if (!this.activeData) {
            //???????? ???? ???????? ?????????????? ?????????????????? ???????????????? ?????? ???? ???????????????????? ?????????????? ?? ?????????????? ???? ????????????????????
            this.setDataInitial(this.dataModel, this.settings.data.mode)
            this.applyFilter()
        }

        this.setArrow(this.dataModel.length)
        this.render()
        this.setEvents()

        this.dataModelPrev = this.dataModel
    }

    //?????????????????? ????????????????
    private supportBookmarksAndFiltersOnReport() {
        const isFilterInReport = this.isFilterInReport()
        if (isFilterInReport) {
            const valueFromJsonFilter = this.options.jsonFilters[0]['values'][0]
            this.activeData = this.findObjectByValue(valueFromJsonFilter)
        }
    }

    private isFilterInReport() {
        const jsonFilters: pbm.AdvancedFilter[] = this.options.jsonFilters as pbm.AdvancedFilter[];
        if (jsonFilters && jsonFilters[0]) {
            return true
        }
        return false
    }

    private render() {
        this.width = this.options.viewport.width;
        this.height = this.options.viewport.height;
        this.svg.attr("width", this.width).attr("height", this.height);
        this.marginVertical = Math.min(this.width, this.height) * 0.1
        this.marginHorizontal = Math.min(this.width, this.height) * 0.5
        const widthRect = this.widthRect = this.width - this.marginHorizontal * 2
        this.heightRect = this.height - this.marginVertical * 2

        this.setShiftVisual()

        const fillText = this.settings.appearance.blackMode ? this.colors.white : this.colors.black
        const fillButton = this.settings.appearance.blackMode ? this.colors.black : this.colors.white

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

        this.setSettinsSmallScreen()
    }

    private clearFilter() {
        this.host.applyJsonFilter(null, "general", "filter", powerbi.FilterAction.merge);
    }

    private applyFilter() {
        if (this.host.hostCapabilities.allowInteractions) {
            let value = this.activeData.data

            const tableAndColumn = interactivityFilterService.extractFilterColumnTarget(<any>this.options.dataViews[0].metadata.columns[0]);

            let target: pbm.IFilterTarget = {
                table: tableAndColumn.table,
                column: tableAndColumn.column
            };

            let advancedFilter: pbm.IAdvancedFilter = {
                $schema: 'http://powerbi.com/product/schema#advanced',
                target: target,
                logicalOperator: 'And',
                conditions: [{ operator: "Is", value: value }],
                filterType: pbm.FilterType.Advanced,
            }

            this.host.applyJsonFilter(advancedFilter, "general", "filter", powerbi.FilterAction.merge);
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

    private doubleClickButtonEvent() {
        this.containerRect.on('dblclick', d => {
            if (this.host.hostCapabilities.allowInteractions) {
                this.setDataInitial(this.dataModel, this.settings.data.mode)
                this.applyFilter()
                this.setArrow(this.dataModel.length)
                this.render()
            }
        })
    }

    private executeAfterAnimate() {
        this.setDataWhenShiftArray(this.dataModel, this.shiftLeft, this.shiftRight)
        this.shiftRight = this.shiftLeft = false
        this.applyFilter()
        this.render()
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

    private getInitialIndexData(dataModel: Data[], order: boolean) {
        return order ? 0 : dataModel.length - 1
    }

    private setDataWhenShiftArray(dataModel: Data[], shiftLeft, shiftRight) {
        if (shiftLeft) {
            //???????????????????????? ?????????? ???? ?????????? ??????????????
            const dataIndex = this.findIndexData(this.activeData)
            this.activeData = dataModel[Math.max(dataIndex - 1, 0)]
        } else if (shiftRight) {
            const dataIndex = this.findIndexData(this.activeData)
            this.activeData = dataModel[Math.min(dataIndex + 1, dataModel.length - 1)]
        }
    }

    private setDataInitial(dataModel: Data[], order) {
        const index = this.getInitialIndexData(dataModel, order)
        this.activeData = dataModel[index]
    }

    private setDataWhenToggleOrderData(dataModel: Data[], order) {
        const index = this.getInitialIndexData(dataModel, order)
        this.activeData = dataModel[index]
    }

    private changeDataModel() {
        if (this.dataModelPrev.length === 0) {
            return false //???????? ?????? ???????????? ?? ?????????????? ?????????????? ???????????? ?????????????????? ?? ???????????? ???? ???????? ?? ?????? ???????????? ????????????????
        }
        const found = this.dataModel.some(d1 => this.dataModelPrev.map(d2 => d2.data).includes(d1.data))
        return !found
    }

    private changeOrderData(order) {
        this.dateModelOrderFlag = order
    }

    private checkToggleOrderData(order: boolean) {
        if (this.dateModelOrderFlag == null) {
            this.dateModelOrderFlag = order
            return false    //???????? ?????? ????????????  ???????????? ?????? ???????????? ????????????????
        }
        return this.dateModelOrderFlag !== order
    }

    private setArrow(dataModelLength: number) {
        const dataIndex = this.findIndexData(this.activeData)

        if (dataIndex === 0) {
            this.disableArrow(this.containerArrowLeft)
            if (dataModelLength === 1) {
                this.disableArrow(this.containerArrowRight)
            } else {
                this.ableArrow(this.containerArrowRight)
            }
        }
        else if (dataIndex === this.dataModel.length - 1) {
            this.disableArrow(this.containerArrowRight)
            this.ableArrow(this.containerArrowLeft)
        }
        else {
            this.ableArrow(this.containerArrowRight)
            this.ableArrow(this.containerArrowLeft)
        }
    }

    private findIndexData(data) {
        return this.dataModel.findIndex(d => d.selectionId.equals(data.selectionId) && d.data === data.data)
    }

    private findObjectByValue(value) {
        return this.dataModel.filter(d => d.data === value)[0] //?????????????? ???????????? ???????????????? ???? ??????????????, ?????????????????? ???? jsonFilter ???????????????? ???????????? ????????????????
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

    private setSettinsSmallScreen() {
        if (this.widthRect / this.heightRect < 0.2) {
            this.rect
                .attr('width', 0)
                .attr('height', 0)

            this.text.style('fill', this.colors.black)
        }
    }

    private drawButton(fill) {
        this.rect
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.widthRect)
            .attr('height', this.heightRect)
            .attr('rx', this.widthRect * 0.09)
            .style('fill', fill)
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

        //?????????????????????????? ???????????????????????? ???? ???????????????? ?????????????? ?????? ???????? ?????????? ?????????? ???????? ?????????????? ???? ??????????????
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

        //?????????????????????????? ???????????????????????? ???? ???????????????? ?????????????? ?????? ???????? ?????????? ?????????? ???????? ?????????????? ???? ??????????????
        this.rectForClickArrowRight
            .attr('x', -nodeArrow.width)
            .attr('y', -nodeArrow.height / 2)
            .attr('width', nodeArrow.width)
            .attr('height', nodeArrow.height)
            .style('fill-opacity', 0)
    }

    private setEvents() {
        this.clickArrowLeftEvent()
        this.clickArrowRightEvent()
        if(this.settings.data.dblClick){
            this.doubleClickButtonEvent()
        } else {
            this.containerRect.on('dblclick', null)
        }
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
                        mode: this.settings.data.mode,
                        dblClick: this.settings.data.dblClick,
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

function visualTransform(options: VisualUpdateOptions, host: IVisualHost, defaultValue): ViewModel {
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
            mode: dataViewObjects.getValue(objects, { objectName: "data", propertyName: "mode" },
                defaultSettings.data.mode),
            dblClick: dataViewObjects.getValue(objects, { objectName: "data", propertyName: "dblClick" },
                defaultSettings.data.dblClick),
        },
        appearance: {
            blackMode: dataViewObjects.getValue(objects, { objectName: "appearance", propertyName: "blackMode" },
                defaultSettings.appearance.blackMode),
        }
    };

    let data: Data[] = []
    categories.values.forEach((d, i) => data.push({
        data: d || defaultValue,
        selectionId: host.createSelectionIdBuilder()
            .withCategory(categories, i)
            .createSelectionId()
    }))

    return {
        dataModel: data,
        settings: settings
    };
}
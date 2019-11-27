import {IInputs, IOutputs} from "./generated/ManifestTypes";
import DataSetInterfaces = ComponentFramework.PropertyHelper.DataSetApi;
import * as atlas from "azure-maps-control";
type DataSet = ComponentFramework.PropertyTypes.DataSet;

export class AzureMapCluststerSpider implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _mapContainer: HTMLDivElement;
    private map: atlas.Map;
    private popup: atlas.Popup;

	/**
	 * Empty constructor.
	 */
    constructor() {

    }

	/**
	 * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
	 * Data-set values are not initialized here, use updateView.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
	 * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
	 * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
	 * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
	 */
    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement) {
        let _map: atlas.Map;
        this._mapContainer = document.createElement('div');
        this._mapContainer.setAttribute("id", "map");
        this._mapContainer.setAttribute("style", "position:absolute;width:100%;min-width:290px;height:100%;");
        container.append(this._mapContainer);

        //URL to custom endpoint to fetch Access token
        var url = 'https://adtokens.azurewebsites.net/api/HttpTrigger1?code=dv9Xz4tZQthdufbocOV9RLaaUhQoegXQJSeQQckm6DZyG/1ymppSoQ==';

        let azMapKey = context.parameters.AzureMapsSubsctiptionKey.raw != null ? context.parameters.AzureMapsSubsctiptionKey.raw : "";
        let zoomParam: number = context.parameters.zoomName.raw ? context.parameters.zoomName.raw : 12;
        
        /* Instantiate map to the div with id "map" */
        var map = new atlas.Map("map", {
            center: [-8.009480, 53.502850],
            zoom: zoomParam,
            view: "Auto",
            authOptions: {
                authType: atlas.AuthenticationType.subscriptionKey,
                subscriptionKey: azMapKey
            }
        });

        let lat: number = 0;
        let lng = 0;
        //Get Users Current Location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                lat = position.coords.latitude;
                lng = position.coords.longitude;
                map.setCamera({ center: [lng, lat], zoom: zoomParam });

                map.events.add('ready', function () {
                    //Create a data source and add it to the map.
                    var dataSource = new atlas.source.DataSource();
                    dataSource.add(new atlas.data.Point([lng, lat]));
                    map.sources.add(dataSource);

                    //Add the layer to the map.
                    map.layers.add(new atlas.layer.SymbolLayer(dataSource, undefined, {iconOptions: {image: 'marker-red'}}));
                });

            }, function () {
            });
        }
        map.events.add('ready', function () {
            map.controls.add([
                new atlas.control.ZoomControl()
                , new atlas.control.StyleControl()
            ],
                { position: atlas.ControlPosition.TopRight }
            );

        });
        this.map = map;
    }


	/**
	 * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
	 */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        if (context.parameters.dataSet.loading) {
            context.parameters.dataSet.paging.setPageSize(5000);
            console.log(context.parameters.dataSet.sortedRecordIds.length);
            return;
        }

        if (context.parameters.dataSet.paging.hasNextPage) {
            context.parameters.dataSet.paging.loadNextPage();
        }
        else {
            context.parameters.dataSet.paging.setPageSize(50);
            let map = this.map;
            let popup = this.popup;
            let maxSpidersParam: number = context.parameters.maxMarkersInSpiderName.raw ? context.parameters.maxMarkersInSpiderName.raw : 20;

            map.events.add('ready', function () {
                popup = new atlas.Popup();
                //Hide popup when user clicks or moves the map.
                //map.events.add('click', popup.close);
                //map.events.add('movestart', popup.close);

                //Create a data source and add it to the map.
                let dataSource = new atlas.source.DataSource(undefined, {
                    cluster: true,
                    clusterRadius: 45,
                    clusterMaxZoom: 15
                });
                map.sources.add(dataSource);
                let latField: string = context.parameters.latFieldName.raw ? context.parameters.latFieldName.raw : "";
                let lngField: string = context.parameters.longFieldName.raw ? context.parameters.longFieldName.raw : "";
                let nameField: string = context.parameters.primaryFieldName.raw ? context.parameters.primaryFieldName.raw : "";
                var dataSet = context.parameters.dataSet;
                for (let currentRecordId of dataSet.sortedRecordIds) {
                    let primaryName = dataSet.records[currentRecordId].getFormattedValue(nameField);
                    let lat: number = dataSet.records[currentRecordId].getFormattedValue(latField) as any;
                    let lng: number = dataSet.records[currentRecordId].getFormattedValue(lngField) as any;
                    if(lat != null && lng != null ){
                    dataSource.add(new atlas.data.Feature(new atlas.data.Point([lng, lat]), {
                        name: primaryName,
                        description: 'Open Record',
                        id: currentRecordId
                    }));
                }
                }

                //Create a layer for rendering clustered data in the data source.
                var clusterBubbleLayer = new atlas.layer.BubbleLayer(dataSource, undefined, {
                    //Scale the size of the clustered bubble based on the number of points inthe cluster.
                    radius: [
                        'step',
                        ['get', 'point_count'],
                        20,         //Default of 20 pixel radius.
                        3, 25,
                        10, 35,
                        30, 50,
                        100, 65,
                        300, 80
                    ],
                    //Change the color of the cluster based on the value on the point_cluster property of the cluster.
                    color: [
                        'step',
                        ['get', 'point_count'],
                        'rgba(75,0,130,0.8)',            //Default to indego. 
                        4, 'rgba(38,91,167,0.8)',
                        16, 'rgba(0, 181, 204,0.8)',     //If the point_count >= 10, color is blue.
                        64, 'rgba(0,155,102,0.8)',
                        256, 'rgba(0,128,0,0.8)'       //If the point_count >= 100, color is green.
                        //1024, 'rgba(128,192,0)'       

                    ],
                    strokeWidth: 0,
                    blur: 0.5,
                    filter: ['has', 'point_count'] //Only rendered data points which have a point_count property, which clusters do.
                });
                //Create a layer to render the individual locations.
                var shapeLayer = new atlas.layer.SymbolLayer(dataSource, undefined, {
                    filter: ['!', ['has', 'point_count']] //Filter out clustered points from this layer.
                });

                //Create the poput template
                var entityName = context.parameters.dataSet.getTargetEntityType();
                let popupTemplate = '<div class="customInfobox"><div class="customInfobox-inner">{name}</div><button class="button" onclick="Xrm.Navigation.openForm({\'entityName\':\'' + entityName + '\', \'entityId\': \'{recordId}\', \'openInNewWindow\': \'true\'})">Open Record</button></div>';

                //Add a click event to the symbol layer.
                map.events.add('click', shapeLayer, function (e) {
                    //Make sure that the point exists.
                    if (e.shapes && e.shapes.length > 0) {
                        var content, coordinate;
                        let coordinate: any;
                        if (e.shapes[0] instanceof atlas.Shape) {
                            let properties: any = e.shapes[0].getProperties();
                            content = popupTemplate.replace(/{name}/g, properties.name).replace(/{description}/g, properties.description).replace(/{recordId}/g, properties.id);
                            coordinate = e.shapes[0].getCoordinates();
                            popup.setOptions({
                                content: content,
                                position: coordinate
                            });
                            popup.open(map);
                        }
                    }
                });
                //Add the clusterBubbleLayer and two additional layers to the map.
                map.layers.add([
                    clusterBubbleLayer,
                    //Create a symbol layer to render the count of locations in a cluster.
                    new atlas.layer.SymbolLayer(dataSource, undefined, {
                        iconOptions: {
                            image: 'none' //Hide the icon image.
                        },
                        textOptions: {
                            textField: '{point_count_abbreviated}',
                            offset: [0, 0.4]
                        }
                    }),
                    shapeLayer
                ]);
                let featureOpts: ISpiderClusterOptions;
                featureOpts = {
                    featureSelected: function (shape, cluster) {
                        //Open the popup.
                        popup.open(map);
                        if (cluster) {
                            let properties: any = shape.getProperties();
                            let content = popupTemplate.replace(/{name}/g, properties.name).replace(/{description}/g, properties.description).replace(/{recordId}/g, properties.id);
                            popup.setOptions({
                                content: content,
                                position: cluster.geometry.coordinates
                            });
                        } else {
                            //@ts-ignore
                            popup.setOptions({
                                //Update the content of the popup.
                                content: '<div style="padding:10px;max-height:200px;overflow-y:auto;">SHAPE'
                                    //+ object2Table(properties) 
                                    + '</div>',
                                //Update the position of the popup with the symbols coordinate.
                                position: shape.getCoordinates(),
                                //Offset the popups position for better alignment with the layer.
                                pixelOffset: [0, 0]
                            });
                        }
                    },
                    featureUnselected: function () {
                        popup.close();
                    }, maxFeaturesInWeb: maxSpidersParam
                };
                let spiderManager = new SpiderClusterManager(map, clusterBubbleLayer, shapeLayer, featureOpts);
            });
        }
    }

	/** 
	 * It is called by the framework prior to a control receiving new data. 
	 * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as “bound” or “output”
	 */
    public getOutputs(): IOutputs {
        return {};
    }

	/** 
	 * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
	 * i.e. cancelling any pending remote calls, removing listeners, etc.
	 */
    public destroy(): void {
        // Add code to cleanup control if necessary
    }
}

/*
 * Copyright(c) 2019 Microsoft Corporation. All rights reserved. 
 * 
 * This code is licensed under the MIT License (MIT). 
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal 
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do 
 * so, subject to the following conditions: 
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software. 
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE. 
*/

/**
* Options used to customize how the SpiderClusterManager renders clusters.
*/
interface ISpiderClusterOptions {
    /** Minimium number of point features in cluster before switching from circle to spiral spider layout. Default: 6 */
    circleSpiralSwitchover?: number;

    /** The minium pixel distance between point features and the cluster, when rendering spider layout as a circle. Default: 30 */
    minCircleLength?: number;

    /** The minium angle between point features in the spiral. Default: 25 */
    minSpiralAngleSeperation?: number;

    /** The maximum number of features that can be rendered in the spider layout. When the cluster is bigger than this value, it will zoom until the cluster starts to break apart. Default: 100 */
    maxFeaturesInWeb?: number;

    /** A factor that is used to grow the pixel distance of each point feature from the center in the spiral. Default: 5 */
    spiralDistanceFactor?: number;

    /** Layer options used to style the stick connecting the individual point feature to the cluster. */
    stickLayerOptions?: atlas.LineLayerOptions;

    /**
    * A callback function that is fired when an individual point feature is clicked.
    * If the point feature is part of a cluster, the cluster will also be returned in the callback.
    */
    featureSelected?: (shape: atlas.Shape, cluster: atlas.data.Feature<atlas.data.Point, any>) => void;

    /** A callback that is fired when a point feature is unselected or a spider cluster is collapsed. */
    featureUnselected?: () => void;

    /** A boolean indicating if the cluster layer is visible or not. */
    visible?: boolean;
}

/**
* Adds a clustering layer to the map which expands clusters into a spiral spider layout.
*/
class SpiderClusterManager {

    /**********************
    * Private Properties
    ***********************/

    private _map: atlas.Map;
    private _datasource: atlas.source.DataSource;
    private _spiderDataSource: atlas.source.DataSource;
    private _clusterLayer: atlas.layer.BubbleLayer | atlas.layer.SymbolLayer;
    private _unclustedLayer: atlas.layer.BubbleLayer | atlas.layer.SymbolLayer;
    private _spiderFeatureLayer: atlas.layer.BubbleLayer | atlas.layer.SymbolLayer;
    private _spiderLineLayer: atlas.layer.LineLayer;
    private _hoverStateId: string = '';
    private _spiderDatasourceId: string;
    private _currentCluster: atlas.data.Feature<atlas.data.Point, any>;

    private _options: ISpiderClusterOptions = {
        circleSpiralSwitchover: 6,
        minCircleLength: 30,
        minSpiralAngleSeperation: 25,
        spiralDistanceFactor: 5,
        maxFeaturesInWeb: 5,
        stickLayerOptions: {
            strokeColor: [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                'red',
                'black'
            ]
        },
        featureSelected: undefined,
        featureUnselected: undefined
    };

    /**********************
    * Constructor
    ***********************/

    /**
    * @constructor
    * A cluster manager that expands clusters when selectd into a spiral layout.
    * @param map A map instance to add the cluster layer to.
    * @param clusterLayer The layer used for rendering the clusters.
    * @param options A combination of SpiderClusterManager and Cluster options.
    */
    constructor(map: atlas.Map, clusterLayer: atlas.layer.BubbleLayer | atlas.layer.SymbolLayer,
        unclustedLayer: atlas.layer.BubbleLayer | atlas.layer.SymbolLayer, options: ISpiderClusterOptions) {

        this._map = map;
        this._clusterLayer = clusterLayer;

        var s = clusterLayer.getSource();
        if (typeof s === 'string') {
            s = map.sources.getById(s);
        }

        if (s instanceof atlas.source.DataSource) {
            this._datasource = s;
        } else {
            throw 'Data source on cluster layer is not supported.';
        }

        this._options = options;

        //Create a data source to manage the spider lines. 
        this._spiderDataSource = new atlas.source.DataSource();
        map.sources.add(this._spiderDataSource);

        this._spiderDatasourceId = this._spiderDataSource.getId();

        this._spiderLineLayer = new atlas.layer.LineLayer(this._spiderDataSource, undefined, this._options.stickLayerOptions);
        map.layers.add(this._spiderLineLayer);

        //Make a copy of the cluster layer options.
        var unclustedLayerOptions = this._deepCopy(unclustedLayer.getOptions(), ['source']);
        unclustedLayerOptions.filter = ['any', ['==', ['geometry-type'], 'Point'], ['==', ['geometry-type'], 'MultiPoint']] //Only render Point or MultiPoints in this layer.;        

        this._unclustedLayer = unclustedLayer;

        if (unclustedLayer instanceof atlas.layer.BubbleLayer) {
            this._spiderFeatureLayer = new atlas.layer.BubbleLayer(this._spiderDataSource, undefined, unclustedLayerOptions);
        } else {
            unclustedLayerOptions.iconOptions = unclustedLayerOptions.iconOptions || {};
            unclustedLayerOptions.iconOptions.allowOverlap = true;
            unclustedLayerOptions.iconOptions.ignorePlacement = true;
            this._spiderFeatureLayer = new atlas.layer.SymbolLayer(this._spiderDataSource, undefined, unclustedLayerOptions);
        }

        map.layers.add(this._spiderFeatureLayer);

        this.setOptions(options);

        map.events.add('click', this.hideSpiderCluster);
        map.events.add('movestart', this.hideSpiderCluster);
        map.events.add('mouseleave', this._spiderFeatureLayer, this._unhighlightStick);
        map.events.add('mousemove', this._spiderFeatureLayer, this._highlightStick);
        map.events.add('click', this._clusterLayer, this._layerClickEvent);
        map.events.add('click', this._spiderFeatureLayer, this._layerClickEvent);
        map.events.add('click', this._unclustedLayer, this._layerClickEvent);
    }

    /**********************
    * Public Functions
    ***********************/

    /**
    * Disposes the SpiderClusterManager and releases it's resources.
    */
    public dispose(): void {
        //Remove events.
        this._map.events.remove('click', this.hideSpiderCluster);
        //this._map.events.remove('movestart', this.hideSpiderCluster);
        //@ts-ignore
        this._map.events.remove('click', this._clusterLayer, this._layerClickEvent);
        //@ts-ignore
        this._map.events.remove('mouseleave', this._spiderFeatureLayer, this._unhighlightStick);
        //@ts-ignore
        this._map.events.remove('mousemove', this._spiderFeatureLayer, this._highlightStick);
        //@ts-ignore
        this._map.events.remove('click', this._spiderFeatureLayer, this._layerClickEvent);
        //@ts-ignore
        this._map.events.remove('click', this._unclustedLayer, this._layerClickEvent);

        //Remove layers.
        this._map.layers.remove(this._spiderFeatureLayer);
        //@ts-ignore
        this._spiderFeatureLayer = null;

        this._map.layers.remove(this._spiderLineLayer);
        //@ts-ignore
        this._spiderLineLayer = null;


        //Clear and dispose of datasource.
        this._spiderDataSource.clear();
        this._map.sources.remove(this._spiderDataSource);
        //@ts-ignore
        this._spiderDataSource = null;
    }

    /**
    * Collapses any open spider clusters.
    */
    private hideSpiderCluster = (): void => {
        this._spiderDataSource.clear();
    }

    /**
    * Sets the options used to customize how the SpiderClusterManager renders clusters.
    * @param options The options used to customize how the SpiderClusterManager renders clusters.
    */
    public setOptions(options: ISpiderClusterOptions): void {
        this.hideSpiderCluster();

        if (options) {
            if (typeof options.circleSpiralSwitchover === 'number') {
                this._options.circleSpiralSwitchover = options.circleSpiralSwitchover;
            }

            if (typeof options.maxFeaturesInWeb === 'number') {
                this._options.maxFeaturesInWeb = options.maxFeaturesInWeb;
            }

            if (typeof options.minSpiralAngleSeperation === 'number') {
                this._options.minSpiralAngleSeperation = options.minSpiralAngleSeperation;
            }

            if (typeof options.spiralDistanceFactor === 'number') {
                this._options.spiralDistanceFactor = options.spiralDistanceFactor;
            }

            if (typeof options.minCircleLength === 'number') {
                this._options.minCircleLength = options.minCircleLength;
            }

            if (options.stickLayerOptions) {
                this._options.stickLayerOptions = options.stickLayerOptions;
                this._spiderLineLayer.setOptions(options.stickLayerOptions);
            }

            if (options.featureSelected) {
                this._options.featureSelected = options.featureSelected;
            }

            if (options.featureUnselected) {
                this._options.featureUnselected = options.featureUnselected;
            }

            if (typeof options.visible === 'boolean' && this._options.visible !== options.visible) {
                this._options.visible = options.visible;
                this._spiderLineLayer.setOptions({ visible: options.visible });
                (<atlas.layer.SymbolLayer>this._spiderFeatureLayer).setOptions({ visible: options.visible });
            }
        }
    }

    /**
    * Expands a cluster into it's open spider layout.
    * @param cluster The cluster to show in it's open spider layout.
    */
    public showSpiderCluster(cluster: atlas.data.Feature<atlas.data.Point, atlas.ClusteredProperties>): void {
        this.hideSpiderCluster();

        if (cluster && (<atlas.ClusteredProperties>cluster.properties).cluster) {
            this._datasource.getClusterLeaves((<atlas.ClusteredProperties>cluster.properties).cluster_id, this._options.maxFeaturesInWeb == null ? 5 : this._options.maxFeaturesInWeb, 0).then((children) => {
                //Create spider data.
                var center = cluster.geometry.coordinates;
                var centerPoint = this._map.positionsToPixels([center])[0];
                var angle: number = 0;

                let makeSpiral: boolean = children.length > (this._options.circleSpiralSwitchover == undefined ? 6 : this._options.circleSpiralSwitchover);

                var legPixelLength: number;
                var stepAngle: number = 5;
                var stepLength: number = 5;

                if (makeSpiral) {
                    legPixelLength = (this._options.minCircleLength == null ? 30 : this._options.minCircleLength) / Math.PI;
                    stepLength = 2 * Math.PI * (this._options.spiralDistanceFactor == undefined ? 5 : this._options.spiralDistanceFactor);
                } else {
                    stepAngle = 2 * Math.PI / children.length;

                    legPixelLength = ((this._options.spiralDistanceFactor == undefined ? 5 : this._options.spiralDistanceFactor) / stepAngle / Math.PI / 2) * children.length;

                    if (legPixelLength < (this._options.minCircleLength == null ? 30 : this._options.minCircleLength)) {
                        legPixelLength = this._options.minCircleLength == null ? 30 : this._options.minCircleLength;
                    }
                }

                var shapes = [];

                for (var i = 0, len = children.length; i < len; i++) {
                    //Calculate spider point feature location.
                    if (makeSpiral) {
                        angle += (this._options.minSpiralAngleSeperation == undefined ? 25 : this._options.minSpiralAngleSeperation) / legPixelLength + i * 0.0005;
                        legPixelLength += stepLength / angle;
                    } else {
                        angle = stepAngle * i;
                    }

                    var pos = this._map.pixelsToPositions([[
                        centerPoint[0] + legPixelLength * Math.cos(angle),
                        centerPoint[1] + legPixelLength * Math.sin(angle)]])[0];

                    //Create stick to point feature.
                    var stick = new atlas.data.Feature(new atlas.data.LineString([center, pos]), null, i + '');
                    shapes.push(stick);

                    //Create point feature in spiral that contains same metadata as parent point feature.
                    var c = children[i];
                    var p = (c instanceof atlas.Shape) ? c.getProperties() : c.properties;
                    var id = (c instanceof atlas.Shape) ? c.getId() : c.id;

                    //Make a copy of the properties.
                    p = this._deepCopy(p);
                    p._stickId = i + '';
                    p._parentId = id;

                    shapes.push(new atlas.data.Feature(new atlas.data.Point(pos), p));
                }

                this._spiderDataSource.add(shapes);
            });
        }
    }

    /**********************
    * Private Functions
    ***********************/

    /**
    * Click event handler for when a shape in the cluster layer is clicked. 
    * @param e The mouse event argurment from the click event.
    */
    private _layerClickEvent = (e: atlas.MapMouseEvent): void => {
        if (e && e.shapes && e.shapes.length > 0) {

            var prop;
            var pos: any;
            var s: atlas.Shape;
            var f: any = undefined;

            if (e.shapes[0] instanceof atlas.Shape) {
                s = <atlas.Shape>e.shapes[0];
                prop = s.getProperties();
                pos = s.getCoordinates();
            } else {
                f = <atlas.data.Feature<atlas.data.Point, any>>e.shapes[0];
                prop = f.properties;
                pos = f.geometry.coordinates;
            }

            if (prop.cluster) {
                if (this._options.featureUnselected) {
                    this._options.featureUnselected();
                }

                this._currentCluster = <atlas.data.Feature<atlas.data.Point, any>>e.shapes[0];

                if (prop.point_count > (this._options.maxFeaturesInWeb == undefined ? 5 : this._options.maxFeaturesInWeb)) {
                    this._datasource.getClusterExpansionZoom(prop.cluster_id).then(zoom => {
                        this._map.setCamera({
                            center: pos,
                            zoom: zoom
                        });
                    });
                } else {
                    this.showSpiderCluster(f);
                }
            } else {
                if (typeof prop._parentId !== 'undefined') {
                    s = this._datasource.getShapeById(prop._parentId);
                    if (this._options.featureSelected && s) {
                        this._options.featureSelected(s, this._currentCluster);
                    }
                } else {
                    // this._currentCluster = null;
                }


                this.hideSpiderCluster();
            }

            e.preventDefault();
        }
    }

    private _highlightStick = (e: atlas.MapMouseEvent): void => {
        if (e && e.shapes && e.shapes.length > 0) {
            var stickId: string;

            if (e.shapes[0] instanceof atlas.Shape) {
                stickId = (<atlas.Shape>e.shapes[0]).getProperties()._stickId;
            } else {
                stickId = (<atlas.data.Feature<atlas.data.Point, any>>e.shapes[0]).properties._stickId;
            }

            if (this._hoverStateId) {
                //TODO: replace with built-in function.
                //@ts-ignore
                this._map.map.setFeatureState({ source: this._spiderDatasourceId, id: this._hoverStateId }, { hover: false });
            }

            this._hoverStateId = stickId;
            //TODO: replace with built-in function.
            //@ts-ignore
            this._map.map.setFeatureState({ source: this._spiderDatasourceId, id: this._hoverStateId }, { hover: true });
        }
    }

    private _unhighlightStick = (e: atlas.MapMouseEvent): void => {
        if (this._hoverStateId) {
            //TODO: replace with built-in function.
            //@ts-ignore
            this._map.map.setFeatureState({ source: this._spiderDatasourceId, id: this._hoverStateId }, { hover: false });
            this._hoverStateId = '';
        }
    }

    private _deepCopy(obj: any, filter?: string[]): any {
        var copy = obj,
            k;

        if (obj && typeof obj === 'object') {
            copy = Object.prototype.toString.call(obj) === '[object Array]' ? [] : {};
            for (k in obj) {
                if (!Array.isArray(filter) || (Array.isArray(filter) && filter.indexOf(k) !== -1)) {
                    copy[k] = this._deepCopy(obj[k], filter);
                }
            }
        }

        return copy;
    }
}
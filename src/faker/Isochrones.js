'use strict';

let Promise = require('bluebird');
let utils = require('../lib/utils');
let concave = require('@turf/concave');
let Isochrone = require('osrm-isochrone');

let OSRM = require('osrm.js');
let osrm = new OSRM('http://localhost:5000');
osrm._timeout = 10000;

class FakerIsochrones {
    constructor(customers, restaurants, drivers, orders, options) {

        this.db = utils.getDatabase();

        this.data = {
            customers: customers || [],
            restaurants: restaurants || [],
            drivers: drivers || [],
            orders: orders || [],
            isochrones: []
        };

        console.log(
            `FakerIsochrones: Creating ${this.data.restaurants.length + this.data.customers.length} Isochrones`
        );

        return this.generate(options)
            .then((dataList) => {
                return Promise.all(
                    dataList.map((data) => this.save(data))
                ).then(()=>{
                    return this;
                });

            });
    }
    /**
     * Generate dat
     * @returns {Promise.<*>}
     */
    generate(options) {
        let promiseMap = [];

        let startTime = 150; // 300 second drivetime (5 minutes)
        // Note: coordinates are E/W , N/S
        let opts = options || {
            resolution: 50, // sample resolution
            maxspeed: 65, // in 'unit'/hour
            unit: 'miles', // 'miles' or 'kilometers'
            network: osrm  // prebuilt dc osrm network file, or use the one just built.
        };


        this.data.customers.forEach((customer) => {
            promiseMap.push([5, customer, startTime, opts]);
        });

        this.data.restaurants.forEach((restaurant) => {
            promiseMap.push([5, restaurant, startTime, opts]);
        });

        this.data.drivers.forEach((driver) => {
            promiseMap.push([5, driver, startTime, opts]);
        });

        return Promise.mapSeries(promiseMap, (args) => {
            console.log(`Creating ${args[1].properties.type} ${args[1].properties._id} isochrone`);
            return this.getIsochrones(...args)
        });
    }

    save(data) {

        data.properties._id = `uuid-${Math.floor(utils.getRandomInt(10000, 100000000))}`;
        data.properties.type = 'isochrone';

        data.properties.stroke ="#555555";
        data.properties['stroke-width'] =2;
        data.properties['stroke-opacity'] = 1;
        data.properties.fill = "#008000";
        data.properties['fill-opacity'] = 0.5;

        if (typeof this.data.isochrones === 'undefined')
            this.data.isochrones = [];
        this.data.isochrones.push(data);


        return this.db.post(data);
    }


    getCoords(place) {
    return [
        parseFloat(place.geometry.coordinates[0]),
        parseFloat(place.geometry.coordinates[1])
    ]
}

    getIsochrone(place, location, time, options, cb) {
    let type = place.properties.type;
    let isCustomer = type === 'customer';
    let isRestaurant = type === 'restaurant';
    // console.log('API - GetIsochrone', arguments);
    /**
     * IsoChrone
     * @type {module.exports}
     */
    let isochrone = new Isochrone(location, time, options, cb);

    /**
     * Override of the draw function
     * @param destinations
     * @returns {*}
     */
    isochrone.draw = function (destinations) {
        //console.log('Draw');
        // Filter features
        let inside = destinations.features.filter(function (feat) {
            return feat.properties.eta <= time;
        });
        destinations.features = inside;

        // Create Polygon
        // return concave(destinations, this.sizeCellGrid, options.unit);
        let result;
        try {
            result = concave(destinations, 2, 'miles');
            result.properties.type = "isochrone";
            result.properties['show_on_map'] = time > 100 ? true : false;
            result.properties.stroke =isRestaurant ? "#0000ff" : isCustomer ? "#008000" : "#F00000";
            result.properties['stroke-width'] =2;
            result.properties['stroke-opacity'] = .1;
            result.properties.fill = isRestaurant ? "#0000ff" : isCustomer ? "#008000" : "#F00000";
            result.properties['fill-opacity'] = 0.2;
            result.properties.eta = time;
            result.properties[`${type}_id`] = place.properties.id;
        } catch(err){
            // console.log('ERRROR', err);
            result = {
                "type": "Feature",
                "properties": {
                    "type": "error"
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        -92.03716993331909,
                        30.206212022669046
                    ]
                }
            }
        }
        return result;
    };

    isochrone.getIsochrone();
}



    getIsochrones(rings, place, startTime, opts, cb){
    let location = this.getCoords(place);
    // console.log('API - GetIsochrones', arguments);
    return new Promise((resolve, reject)=>{
        let data = [];
        for (let i = 0; i < rings; i++) {
            try {
                this.getIsochrone(place, location, startTime * (i + 1), opts, (err, drivetime) => {
                    // console.log('API - gotIsochrone', drivetime);
                    if (err) reject(err);

                    data.push(drivetime);
                    if (data.length === rings)
                        resolve({
                            "type": "FeatureCollection",
                            "features": data,
                            "properties": {
                                "stroke": place.properties.stroke,
                                "stroke-width": place.properties['stroke-width'],
                                "stroke-opacity": place.properties['stroke-opacity'],
                                "fill": place.properties.fill,
                                "fill-opacity": place.properties['fill-opacity']

                            }
                        });
                });
            } catch(err){
                // console.log('ERRRZ', err);
                reject(err);
                resolve({
                    "type": "Feature",
                    "geometry": {
                        "type": "MultiPolygon",
                        "coordinates": []
                    },
                    "properties": {}
                })
            }
        }
    });

}

}

module.exports = FakerIsochrones;
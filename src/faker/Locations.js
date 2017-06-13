'use strict';

const SCHEMA = require('../../docs/schemas/Location.json');
const LOCATION_TYPES = ["customer", "restaurant", "driver"];

const MIN = 10; // Minimum number of each location type to generate
const MAX = 15; // Maximum number of each location type to generate

const MIN_LAT = -92.09598541259766; //Scott
const MAX_LAT = -91.9552230834961; //Broussard
const MIN_LON = 30.31895142366329; // Carencro
const MAX_LON = 30.101771656509502; // Youngsville

let request = require('request');
let utils = require('../lib/utils');
let Promise = require('bluebird');
let jsf = require('json-schema-faker');

let OSRM = require('osrm.js');
let osrm = new OSRM('http://localhost:5000');

let turf = require('@turf/turf');


/**
 * Magic Location Faker
 */
class FakerLocations {
    /**
     * Gimmie some Locations PLz
     * @param min
     * @param max
     */
    constructor(min, max) {
        this.db = utils.getDatabase();

        this.min = min || MIN;
        this.max = max || MAX;
        this.data = {};

        console.log(
            'FakerLocations: Creating between ' +
            `${(LOCATION_TYPES.length - 1) * this.min} and ${(LOCATION_TYPES.length - 1) * this.max}` +
            ' Locations'
        );
        return this.generate()
            .then((dataList) => {
                dataList.forEach((record) => this.save(record));
                return this;
            });
    }


    /**
     * Generate dat
     * @returns {Promise.<*>}
     */
    generate() {
        let promiseAll = [];
        // Map each location type to a random number of records to create
        LOCATION_TYPES.map(
            (type) => {
                let max = this.max;
                //Generate Drivers based on 6-8% of the max places in the test
                if (type === "driver") max *= utils.getRandomInt(6, 8) / 100;

                //
                return utils.getRandomInt(this.min, max); // Return the counter
            })
            .forEach((count, indx) => {
                for (let i = 0; i < count; i++) {
                    promiseAll.push(this.faker(LOCATION_TYPES[indx]));
                }
            });


        return Promise.all(promiseAll);
    }

    getBounds() {
        return new Promise((resolve, reject) => {
            if (this.bounds) resolve(this.bounds)
            else request.get("http://whosonfirst.mapzen.com/data/859/483/77/85948377.geojson",
                (error, response, body) => {
                    if (body) {
                        this.bounds = JSON.parse(body);
                        resolve(this.bounds);
                    } else reject(new Error("Can't download city bounds"));
                });
        });
    }

    /**
     * Magic Faker
     * @param type
     * @returns {Promise}
     */
    faker(type) {
        // Quick Lookups for formatting geojson
        let isRestaurant = type === "restaurant";
        let isCustomer = type === "customer";
        let isDriver = type === "driver";

        // Fake the Data based on Schema
        return jsf.resolve(SCHEMA)
        // Transform the faked data to a GeoJSON point, snapped to a route
            .then((faked) => {
                return this.getBounds().then((geojson) => {
                    return new Promise((resolve, reject) => {
                        let point = [utils.getRandomFloat(MIN_LAT, MAX_LAT), utils.getRandomFloat(MIN_LON, MAX_LON)];
                        let isInside = turf.inside(point, geojson);
                        while(!isInside){
                            // console.log('Random Point Miss!', point);
                            point = [utils.getRandomFloat(MIN_LAT, MAX_LAT), utils.getRandomFloat(MIN_LON, MAX_LON)];
                            isInside = turf.inside(point, geojson);
                        }
                        // console.log('Random Point Hit!', point);
                        let options = {
                            coordinates: [point]
                        };

                        // Set default formatting
                        let color = isRestaurant ? "#0000ff" : isCustomer ? "#008000" : "#F00000";
                        let symbol = isRestaurant ? "restaurant" : isCustomer ? "heart" : "circle";

                        // Snap to a route
                        osrm.nearest(options, (err, res) => {
                            if (err) reject(err);

                            // Create a GeoJson Point
                            let fileData = turf.point(res.waypoints[0].location);
                            // Add faked data to GeoJSON Properties
                            fileData.properties = faked;
                            // GUID
                            fileData.properties._id = `uuid-${Math.floor(utils.getRandomInt(10000, 100000000))}`;
                            // Marker Formatting
                            fileData.properties["marker-color"] = color;
                            fileData.properties["marker-symbol"] = symbol;
                            fileData.properties.type = type;
                            // Cleanup Properties
                            delete faked.coordinates;
                            resolve(fileData);
                        });
                    });
                });
            })
    }

    save(data) {
        let type = `${data.properties.type}s`;
        if (typeof this.data[type] === 'undefined')
            this.data[type] = [];
        this.data[type].push(data);

        return this.db.post(data);
    }

}

module.exports = FakerLocations;
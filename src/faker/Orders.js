'use strict';

const SCHEMA = require('../../docs/schemas/Order.json');

const MIN = 5; // % of customers that have order min
const MAX = 10; // % of customers that have orders max

const HOURS_BACK = 4;
const HOURS_FORWARD = 4;


let utils = require('../lib/utils');
let Promise = require('bluebird');
let jsf = require('json-schema-faker');

/**
 * Magic Location Faker
 */
class FakerOrders {
    /**
     * Gimmie some Locations PLz
     * @param min
     * @param max
     */
    constructor(min, max, customers, restaurants, drivers) {
        this.db = utils.getDatabase();

        this.data = {
            customers: customers || [],
            restaurants: restaurants || [],
            drivers: drivers || [],
            orders: []
        };
        this.min = this.data.customers.length * (min || MIN) / 100;
        this.max = this.data.customers.length * (max || MAX) / 100;

        console.log(
            'FakerOrders: Creating between ' +
            `${this.min} and ${this.max}` +
            ' Orders'
        );
        return this.generate()
            .then((dataList) => {
                dataList.map((data) => this.save(data));
                return this;
            });
    }

    /**
     * Generate dat
     * @returns {Promise.<*>}
     */
    generate() {
        console.log('GenerateOrders');

        let promiseAll = [];
        if (typeof this.data.customers === 'undefined' || this.data.customers.length <= 0) throw new Error('No Data Found!');

        let count = utils.getRandomInt(this.min, this.max);

        for (let i = 0; i < count; i++) {
            promiseAll.push(this.faker(utils.getRandomInt(i, this.data.customers.length - 1)));
        }

        return Promise.all(promiseAll);
    }

    faker(offset) {
        return jsf.resolve(SCHEMA)
            .then((faked) => {
                let ts = new Date();
                let orderTs = new Date(utils.getRandomInt(
                    utils.subMinutes(ts, HOURS_BACK * 60).getTime(),
                    utils.addMinutes(ts, HOURS_FORWARD * 60).getTime()
                ));

                let data = {
                    properties: {
                        _id: `uuid-${Math.floor(utils.getRandomInt(10000, 100000000))}`,
                        customer_id: this.data.customers[offset].properties._id,
                        restaurant_id: this.data.restaurants[utils.getRandomInt(0, this.data.restaurants.length - 1)].properties._id,
                        timestamp: orderTs,
                        expected_delivery: utils.addMinutes(orderTs, 45),
                        type: "order"
                    }
                };

                Object.keys(faked).forEach((key) => {
                    if (typeof data.properties[key] === "undefined") data.properties[key] = faked[key];
                });

                return data;
            });
    }

    save(data) {
        let type = `${data.properties.type}s`;
        if (typeof this.data[type] === 'undefined')
            this.data[type] = [];
        this.data[type].push(data);

        return this.db.post(data);
    }
}

module.exports = FakerOrders;
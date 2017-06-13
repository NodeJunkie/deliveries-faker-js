let pouchdb =require('pouchdb');
module.exports = {
    /**
     * Returns a random float set to 6 decimals
     * @param min
     * @param max
     * @returns {string}
     */
    getRandomFloat: function (max, min) {
        return Math.random() * (max - min) + min;
    },

    /**
     * Returns a random integer between min (inclusive) and max (inclusive)
     * Using Math.round() will give you a non-uniform distribution!
     */
    getRandomInt: function (min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    addMinutes: function (date, minutes) {
        return new Date(date.getTime() + minutes*60000);
    },
    subMinutes: function (date, minutes) {
        return new Date(date.getTime() - minutes*60000);
    },

    getDatabase: function(){
        return this.database;
    },
    setDatabase: function(databaseUrl){
        this.database = new pouchdb(databaseUrl);
        return this.getDatabase();
    },
    getCoords: function (place) {
    return [
        parseFloat(place.geometry.coordinates[0]),
        parseFloat(place.geometry.coordinates[1])
    ]
}
};
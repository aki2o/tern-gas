#!/usr/bin/env node

var opts = require("opts");
var spawn = require("child_process").spawn;

opts.parse([{ short: "v",
              long: "verbose",
              description: "Show verbose.",
              value: false, }],
           true);

var verbose = opts.get("verbose");
var coptstr = verbose ? "--verbose" : "";
var sc_fetcher = "fetch_script_reference.js";
var sc_fetcher_path = __dirname+"/"+sc_fetcher;

function run_make_plugin() {
    var ctlist = [];
    var proc = spawn(process.argv[0], [sc_fetcher_path, "--category-list"]);
    proc.on("error", function (err) {
        console.error("Failed get category list : "+err);
        process.exit();
    });
    proc.stderr.on("data", function (data) {
        console.error("Failed get category list\n"+data);
        process.exit();
    });
    proc.stdout.on("data", function (data) {
        ctlist = data.toString().split(/\n+/);
    });
    proc.on("close", function (code, sig) {
        if ( ctlist.length == 0 ) {
            console.error("Failed get category list : please check '"+sc_fetcher+" --category-list'");
            process.exit();
        }
        ctlist.forEach(fetch_script_category);
    });
}

function fetch_script_category(category) {
    var proc = spawn(process.argv[0], [sc_fetcher_path, "--category", category, coptstr]);
    proc.on("error", function (err) {
        console.error("Failed fetch script category : "+err);
        process.exit();
    });
    proc.stderr.on("data", console.log);
    proc.stdout.on("data", console.log);
    proc.on("close", function (code, sig) {
        
    });
}

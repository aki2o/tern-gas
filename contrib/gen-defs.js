var request = require("request");
var jsdom = require("jsdom");

var jquery_url = "http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.js";
var svr = "http://developers.google.com";
var rooturi = "/apps-script/reference/";
var categories = ["base", "cache", "charts", "content", "html", "jdbc", "lock", "mail",
                  "properties", "script", "ui", "url-fetch", "utilities", "xml-service",
                  "calendar", "contacts", "docs-list", "document", "drive", "forms",
                  "gmail", "groups", "language", "maps", "sites", "spreadsheet" ];

var typeh = {};
var finished_of = {};

fetch_category("calendar");


function make_definition() {
    if ( ! is_finished() ) return;
    
}

function is_finished() {
    for ( var task in finished_of ) {
        if ( ! finished_of[task] ) return false;
    }
    return true;
}

function fetch_category(category) {
    finished_of[category] = false;
    fetch_document(get_category_url(category), function ($) {
        parse_category_document(category, $);
        finished_of[category] = true;
    });
}

function fetch_type(category, typenm, url) {
    var key = category+"."+typenm;
    finished_of[key] = false;
    fetch_document(url, function ($) {
        parse_type_document(category, typenm, $);
        finished_of[key] = true;
    });
}

function fetch_document(url, success_func) {
    console.log("Start fetch document : "+url);
    request({ url: url }, function(err, res, body) {
        if ( err ) {
            console.error("Failed fetch category:'"+category+"' : "+err);
            return;
        }
        if ( res.statusCode != 200 ) {
            console.error("Failed fetch category:'"+category+"' : Returned status is "+res.statusCode);
            return;
        }
        jsdom.env({ html: body, scripts: [ jquery_url ] , done: function(err, window) {
            if ( err ) {
                console.error("Failed do jsdom : "+err);
                return;
            }
            success_func(window.jQuery);
        }});
    });
};

function parse_category_document(category, $) {
    // Collect type from sidebar
    console.log("Start parse to category : "+category);
    var types = find_types_in_sidebar(category, $);
    if ( ! types ) return;
    var kind = "class";
    var global = true;
    for ( var i = 0; i < types.length; i++ ) {
        var tlink = types.eq(i).find("a");
        if ( tlink.length > 0 ) {
            var typenm = tlink.eq(0).attr("title");
            if ( ! typenm ) continue;
            var url = get_refer_url( category, tlink.eq(0) );
            typeh[typenm] = { name: typenm, kind: kind, global: global, url: url };
            console.log("Found type : name:'"+typenm+"' kind:'"+kind+"' global:'"+global+"'");
            fetch_type(category, typenm, url);
        }
        else {
            var kindval = types.eq(i).find(".tlw-title").text();
            kind = kindval.match(/CLASSES/)    ? "class"
                 : kindval.match(/INTERFACES/) ? "interface"
                 : kindval.match(/ENUMS/)      ? "enum"
                 :                               "";
            global = false;
        }
    }
}

function find_types_in_sidebar(category, $) {
    var titles = $("#gc-sidebar a");
    var categoryurl = get_category_url(category);
    for ( var i = 0; i < titles.length; i++ ) {
        var url = get_refer_url( category, titles.eq(i) );
        if ( ! url || url != categoryurl ) continue;
        console.log("Found category element in sidebar : "+category);
        return titles.eq(i).parent().find("li");
    }
    console.error("Failed find category element in sidebar : "+category);
    return;
}

function parse_type_document(category, typenm, $) {
    var maincontent = $("#gc-content");
    var type = typeh[typenm];
    
    // Get doc of type
    type.doc = get_documentation_from_element( maincontent.find(".type.doc") );
    console.log("Got doc of type:'"+typenm+"' : "+type.doc);
    
    // Get property
    var props = [];
    var propdefs = maincontent.find(".type.toc table.members.property tr");
    for ( var i = 1; i < propdefs.length; i++ ) {
        var e = propdefs.eq(i).find("td");
        var propnm = get_symbol_from_element( e.eq(0) );
        var ptype = get_type_from_cell( category, e.eq(1) );
        var doc = get_documentation_from_element( e.eq(2) );
        props.push( { name: propnm, type: ptype, doc: doc } );
        console.log("Got prop '"+typenm+"' : name:'"+propnm+"' type:'"+ptype+"' doc:'"+doc+"'");
    }
    type.property = props;
    
    // Get method
    var mtds = [];
    var mtdsigh = {};
    var mtddefs = maincontent.find(".type.toc table.members.function tr");
    for ( var i = 1; i < mtddefs.length; i++ ) {
        var e = mtddefs.eq(i).find("td");
        var sig = get_signature_from_element( e.eq(0).find("a") );
        var mtdnm = sig.replace(/\(.+$/, "");
        var url = get_refer_url( category, e.eq(0).find("a").eq(0) );
        var ret = get_type_from_cell( category, e.eq(1) );
        var doc = get_documentation_from_element( e.eq(2) );
        var mtd = { name: mtdnm, signature: sig, return: ret, doc: doc, url: url };
        mtds.push(mtd);
        mtdsigh[sig] = mtd;
        console.log("Got method of '"+typenm+"' : sig:'"+sig+"' ret:'"+ret+"' doc:'"+doc+"'"+"' url:'"+url+"'");
    }
    var mtddetails = maincontent.find(".function.doc");
    for ( var i = 0; i < mtddetails.length; i++ ) {
        var sig = get_signature_from_element( mtddetails.eq(i).find("h3") );
        var mtd = mtdsigh[sig];
        if ( ! mtd ) {
            console.warn("Found unrecognized method of '"+typenm+"' : "+sig);
            continue;
        }
        var args = [];
        var argdefs = mtddetails.eq(i).find("table.function.param tr");
        for ( var ii = 1; ii < argdefs.length; ii++ ) {
            var e = argdefs.eq(ii).find("td");
            var argnm = get_symbol_from_element( e.eq(0) );
            var argtype = get_type_from_cell( category, e.eq(1) );
            var doc = get_documentation_from_element( e.eq(2) );
            args.push({ name: argnm, type: argtype, doc: doc });
            console.log("Got arg of '"+mtd["name"]+"' : name:'"+argnm+"' type:'"+argtype+"' doc:'"+doc+"'");
        }
        mtd.args = args;
    }
    type.method = mtds;
}

function get_category_url(category) {
    return svr + rooturi + category;
}

function get_refer_url(category, a) {
    var href = a ? a.attr("href") : null;
    if ( ! href || href == "" ) {
        return null;
    }
    else if ( href.match(/^\//) ) {
        return svr + href;
    }
    else {
        return svr + rooturi + category + "/" + href;
    }
}

function get_type_from_cell(category, td) {
    var re = /\/([^/]+)\/[^/]+$/;
    var a = td.find("a");
    var typecategory = a.length != 1              ? null
                     : ! a.attr("href")           ? null
                     : ! a.attr("href").match(re) ? category
                     :                              ( a.attr("href").match(re) )[1];
    var typenm = get_symbol_from_element( a.length == 1 ? a : td );
    return typecategory ? typecategory+"."+typenm : typenm.toLowerCase();
}

function get_symbol_from_element(e) {
    return e.text().replace(/\s/g, "");
}

function get_signature_from_element(e) {
    return e.text().replace(/[\t\n]/g, "").replace(/ +/g, " ");
}

function get_documentation_from_element(e) {
    return e.text().replace(/^\s+/, "").replace(/\s+$/, "");
}


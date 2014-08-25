JQUERY_URL = "http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.js";
GOOGLE_DOC_SERVER = "http://developers.google.com";
ROOT_URI = "/apps-script/reference/";
SCRIPT_CATEGORIES = ["base", "cache", "charts", "content", "html", "jdbc", "lock", "mail",
                     "properties", "script", "ui", "url-fetch", "utilities", "xml-service",
                     "calendar", "contacts", "docs-list", "document", "drive", "forms",
                     "gmail", "groups", "language", "maps", "sites", "spreadsheet" ];

gScriptTypeHash = {};
gTaskFinished_Of = {};

var request = require("request");
var jsdom = require("jsdom");
var fs = require('fs');

fetch_category("calendar");



//////////////////////
// Fetch Definition

function fetch_category(category) {
    console.info("Fetch documentation for "+category+" ...");
    gTaskFinished_Of[category] = false;
    fetch_document(get_category_url(category), function ($) {
        parse_category_document(category, $);
        gTaskFinished_Of[category] = true;
        make_plugin();
    });
}

function fetch_type(category, typenm, url) {
    var key = category+"."+typenm;
    gTaskFinished_Of[key] = false;
    fetch_document(url, function ($) {
        parse_type_document(category, typenm, $);
        gTaskFinished_Of[key] = true;
        make_plugin();
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
        jsdom.env({ html: body, scripts: [ JQUERY_URL ] , done: function(err, window) {
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
            var key = category+"."+typenm;
            gScriptTypeHash[key] = { name: typenm, kind: kind, global: global, category: category, url: url };
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
    var type = gScriptTypeHash[category+"."+typenm];
    
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
        mtd.argument = args;
    }
    type.method = mtds;
}

function get_category_url(category) {
    return GOOGLE_DOC_SERVER + ROOT_URI + category;
}

function get_refer_url(category, a) {
    var href = a ? a.attr("href") : null;
    if ( ! href || href == "" ) {
        return null;
    }
    else if ( href.match(/^\//) ) {
        return GOOGLE_DOC_SERVER + href;
    }
    else {
        return GOOGLE_DOC_SERVER + ROOT_URI + category + "/" + href;
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
    return typecategory ? typecategory+"."+typenm : typenm;
}

function get_symbol_from_element(e) {
    return e.text().replace(/\s+/g, "");
}

function get_signature_from_element(e) {
    return e.text().replace(/[\t\n]+/g, "").replace(/ +/g, " ");
}

function get_documentation_from_element(e) {
    return e.text().replace(/^\s+/, "").replace(/\s+$/, "").replace(/\s+/g, " ");
}


/////////////////
// Make Plugin

function make_plugin() {
    if ( ! is_finished() ) return;
    console.log("Start make plugin");
    var fpath = __dirname + "/gas.js";
    console.info("Make plugin file ...");
    var rbuff = fs.readFileSync(__dirname+"/template.js", "utf8");
    var wbuff = rbuff.replace(/'!def'/, JSON.stringify( generate_definition() ));
    fs.writeFile(fpath, wbuff, "utf8", function (err) {
        if ( err ) {
            console.error("Failed write plugin : "+err);
            return;
        }
        console.info("Finished make plugin : "+fpath);
    });
}

function generate_definition() {
    console.log("Start make definition");
    var def = build_global_type_definition();
    def["!name"] = "gas";
    def["!define"] = build_local_type_definition();
    return def;
}

function is_finished() {
    for ( var task in gTaskFinished_Of ) {
        if ( ! gTaskFinished_Of[task] ) return false;
    }
    return true;
}

function build_global_type_definition() {
    var ret = {};
    for ( var key in gScriptTypeHash ) {
        var t = gScriptTypeHash[key];
        if ( ! t.global ) continue;
        ret[t.name] = build_type_definition(t);
    }
    return ret;
}

function build_local_type_definition() {
    var categoryh = {};
    for ( var key in gScriptTypeHash ) {
        var t = gScriptTypeHash[key];
        if ( t.global ) continue;
        if ( ! categoryh[t.category] ) categoryh[t.category] = {};
        var typeh = categoryh[t.category];
        typeh[t.name] = build_type_definition(t);
    }
    return categoryh;
}

function build_type_definition(type) {
    var ret = {};
    ret["!url"] = type.url;
    ret["!doc"] = type.doc;
    ret["prototype"] = build_member_definition(type);
    return ret;
}

function build_member_definition(type) {
    var ret = {};
    var props = type.property;
    for ( var i = 0; i < props.length; i++ ) {
        var p = props[i];
        ret[p.name] = { "!type": build_type_attribute(p.type, false) || "_unknown", "!doc": p.doc };
    }
    var mtds = type.method;
    for ( var i = 0; i < mtds.length; i++ ) {
        var m = mtds[i];
        ret[m.name] = { "!type": build_method_signature(m), "!url": m.url, "!doc": m.doc };
    }
    return ret;
}

function build_method_signature(mtd) {
    var argpart = "";
    var args = mtd.argument || [];
    for ( var i = 0; i < args.length; i++ ) {
        var a = args[i];
        if ( argpart != "" ) argpart += ", ";
        var typeinfo = build_type_attribute(a.type, false) || "_unknown";
        argpart += a.name + ": " + typeinfo;
    }
    var retinfo = build_type_attribute(mtd.return, true);
    var retpart = retinfo ? " -> "+retinfo : "";
    return "fn(" + argpart + ")" + retpart;
}

function build_type_attribute(typeattr, asInstance) {
    if ( ! typeattr || typeattr == "" || typeattr == "void" ) return null;
    var typefullnm = typeattr.replace(/\[\]$/, "");
    var isArray = typefullnm == typeattr ? false : true;
    var typepart = "";
    var type = gScriptTypeHash[typefullnm];
    if ( ! type ) {
        typepart = typefullnm == "Integer" ? "number"
                 :                           typefullnm.toLowerCase();
    }
    else {
        typepart = type.global ? prefix+type.name : prefix+typefullnm;
    }
    var prefix = asInstance ? "+" : "";
    return isArray ? "["+prefix+typepart+"]" : prefix+typepart;
}


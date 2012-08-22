//An interface with dripline through couchdb for the project 8 DAQ

var channel_couch_data=""; //the raw json from querying the channel table
var logger_couch_data=""; //the row json from querying the logger table

//--------These update the global channel/table data

function updateChannelData(doOnSuccess) {
	$.couch.db("dripline_conf").view("objects/channels", {
		success: function(data) {
			channel_couch_data=data;
			if(doOnSuccess!=null)
				doOnSuccess();
	},
		error: function(data) {
			document.getElementById("error_div").innerHTML="error getting data: "+JSON.stringify(data);
		}
	});
}

function updateLoggerData(doOnSuccess) {
	$.couch.db("dripline_conf").view("objects/loggers", {
		success: function(data) {
			logger_couch_data=data;
			if(doOnSuccess!=null)
				doOnSuccess();
			},
		error: function(data) {
			document.getElementById("error_div").innerHTML="error getting data: "+JSON.stringify(data);
		}
		});
}

//---------These functions query logger data-------

function queryLoggerData(starttime,endtime,doOnSuccess) {
	if(endtime!="now")
	$.couch.db("dripline_logged_data").view("log_access/all_logged_data", {
		startkey: starttime,
		endkey: endtime,
		success: function(data) {
			doOnSuccess(data); },
		error: function(data) {
			document.getElementById("error_div").innerHTML="error getting data: "+JSON.stringify(data);
			}
			});
	else
	$.couch.db("dripline_logged_data").view("log_access/all_logged_data", {
		startkey: starttime,
		endkey: endtime,
		success: function(data) {
			doOnSuccess(data); },
		error: function(data) {
			document.getElementById("error_div").innerHTML="error getting data: "+JSON.stringify(data);
			}
			});
}


//---------These functions let you do things when command updates are received----

//an array of functions of the form f(data) that should be called when command is received
var command_listener_functions=[];
dripline_command_database="dripline_cmd"
function start_command_listener() {
	$.couch.db(dripline_command_database).changes().onChange(function(data) {
			for(var i=0;i<command_listener_functions.length;i++)
				command_listener_functions[i](data);
			});
}

//--------------------------------------
//-------------These functions listen for new data coming on to the loggers
//--------------------------------------
var dripline_log_listener_functions=[];
dripline_logger_database="dripline_logged_data";
function start_logger_listener() {
	$.couch.db(dripline_logger_database).changes().onChange(function(data) {
			for(var i=0;i<dripline_log_listener_functions.length;i++)
				dripline_log_listener_functions[i](data);
			});
}




function pad2(number) {
	return (number < 10 ? '0' : '') + number
}

//send a dripline command, and perform the success_function if it seems to work, and the error function something goes wrong
function send_dripline_command(commandstruct,success_function,error_function)
{
	//assemble the command
	var rightnow=new Date();
	//var monthstring=((rightnow.getMonth()).toString().length==1?('0'+rightnow.getMonth().toString()):rightnow.getMonth());
	var datestring=""+rightnow.getFullYear()+"-"+pad2(rightnow.getMonth()+1)+"-"+pad2(rightnow.getDate())+" "+pad2(rightnow.getHours())+":"+pad2(rightnow.getMinutes())+":"+pad2(rightnow.getSeconds());

//	dripline_command={command:{"do":verb , "channel":channel},type: "command",submitted_timestamp: datestring };
	dripline_command={command:commandstruct,type: "command",submitted_timestamp: datestring};
	//send the command off to couchdb
	$.couch.db(dripline_command_database).saveDoc(dripline_command, {
		success: function(data) {
			if(success_function!=null)
				success_function(data);
//			docid=data["id"];
//			docrev=data["rev"]; 
//			watched_command_ids[docid]=data["rev"];
			},
		error: function(data) {
			alert("error "+JSON.stringify(data));
		}
		});
}


//send a dripline command, and perform the success_function if it seems to work, and the error function something goes wrong
function send_dripline_get_command(verb,channel,success_function,error_function)
{
	send_dripline_command({"do":verb,"channel":channel},success_function,error_function);
	//assemble the command
	/*
	var rightnow=new Date();
	var monthstring=((rightnow.getMonth()).toString().length==1?('0'+rightnow.getMonth().toString()):rightnow.getMonth());
	var datestring=""+rightnow.getFullYear()+"-"+pad2(rightnow.getMonth())+"-"+pad2(rightnow.getDate())+" "+pad2(rightnow.getHours())+":"+pad2(rightnow.getMinutes())+":"+pad2(rightnow.getSeconds());
	dripline_command={command:{"do":verb , "channel":channel},type: "command",submitted_timestamp: datestring };
	//send the command off to couchdb
	$.couch.db(dripline_command_database).saveDoc(dripline_command, {
		success: function(data) {
			if(success_function!=null)
				success_function(data);
//			docid=data["id"];
//			docrev=data["rev"]; 
//			watched_command_ids[docid]=data["rev"];
			},
		error: function(data) {
			alert("error "+JSON.stringify(data));
		}
		});
		*/
}

function resultToPrintable(input,precision) {
	var loc=input.search(" ");
	if(loc==-1) return input;
	numberpart=parseFloat(input.substr(0,loc));
	if((numberpart>100)||(numberpart<0.1)) 
		numberpart=numberpart.toExponential(precision);
	else
		numberpart=numberpart.toPrecision(precision+1);
	return numberpart+" "+input.substr(loc);
}

function addTerminalCommandUpdate(termtext,docdata) {
	//plan: timestamp, name, value, final value 
	termtext.innerHTML+="<span class='response_text'>"
		+docdata["command"]["channel"]+" "
		+resultToPrintable(docdata["result"],2)+" "
		+resultToPrintable(docdata["final"],2)
//		+JSON.stringify(docdata)
		+"</span><br>";
}

//key pressed in the terminal window
var last_terminal_autocomplete_state="";
function onKeyPressTerminal(event) {
	var keycode;
	if(window.event) {
		keycode=window.event.keyCode;
	} else {
		keycode=event.which;
	}
	if(keycode==13) {
		last_terminal_autocomplete_state="entered";
		input=document.getElementById("command_terminal_input");
		textbox=document.getElementById("command_terminal_text");
		textbox.innerHTML+="<span class='input_text'>";
		textbox.innerHTML+=input.value;
		textbox.innerHTML+="</span><br>";
		var resp=parseCommandTerminal(input.value);
		if(resp!="") {
			textbox.innerHTML+="<span class='error_text'>"+resp+"</span><br>";
		}
		input.value="";
	}
}

function onKeyUpTerminal(event) {
	input=document.getElementById("command_terminal_input");
	var words=input.value.split(" ");
	commandlist=document.getElementById("commands");
	if(words.length==1) {
		if(last_terminal_autocomplete_state=="verb") return;
		commandlist.innerHTML="<option value='get'><option value='set'>";
		last_terminal_autocomplete_state="verb";
	} else {
		if(last_terminal_autocomplete_state=="channel") return;
		var new_html="";
		var channelname_row=1;
		for(var i=0;i<channel_table.getNumberOfRows();i++) {
			var cname=new String(channel_table.getValue(i,channelname_row));
			new_html+="<option value='"+words[0]+" "+cname+"'>";
		}
		commandlist.innerHTML=new_html;
		last_terminal_autocomplete_state="channel";
	}
}

function parseCommandTerminal(command) {
	var words=command.split(" ");
	if(words[0]=="get") {
		send_dripline_get_command(words[0],words[1]);
	} else if(words[0]=="set") {
	} else {
		return "verb not recognized";
	}
	return "";
}

//autosuggest channel names
function autocomplete_channel(formid)
{
	textbox=document.getElementById(formid);
	textsofar=textbox.value;
	if(textsofar.length<1) {
		textbox=document.getElementById("suggestions").innerHTML="";
		return; //don't compare empty string
	}
	var channelname_row=1;
//	var possible_matches={};
	var selection=[];
	var selection_text="";
	for(var i=0;i<channel_table.getNumberOfRows();i++) {
		var cname=new String(channel_table.getValue(i,channelname_row));
		if(cname.search(textsofar)!=-1) {
			selection[selection.length]={ row: i,column: null};
//			matches[cname]=true;
			selection_text+=" "+cname;
		}
	}
	textbox=document.getElementById("suggestions").innerHTML=selection_text;
//	alert("selection was: " + JSON.stringify(selection));
//	channel_display_table.setSelection(selection);
}

//converts dripline date string into javascript date
function driplineStringToDate(dripstring) {
	var date_time=dripstring.split(" ");
	var ymd=date_time[0].split("-");
	var hms=date_time[1].split(":");
	return new Date(ymd[0],ymd[1],ymd[2],hms[0],hms[1],hms[2],0);
}

//builds a gviz datatable from logged data
//assumes keys are ordered ascending.  I think that's always true.
function buildGvizFromLoggedData(rawdata,columnnames,granularity) {
	//prep the data table
	var datatable=new google.visualization.DataTable();
	datatable.addColumn("datetime","datetime","datetime");
	var columnmap={};
	for(var i=0;i<columnnames.length;i++) {
		datatable.addColumn("number",columnnames[i],columnnames[i]);
		columnmap[columnnames[i]]=i+1;
	}
	for(var i=0;i<rawdata.rows.length;i++) {
		if(typeof columnmap[rawdata.rows[i].value.sensor_name] == "undefined")
			continue; //ignore sensors not in my set
		var ondate=driplineStringToDate(rawdata.rows[i].key);
		//check if I'm adding a new row or updating an old row
		if((datatable.getNumberOfRows()==0)||((ondate.getTime()-datatable.getValue(datatable.getNumberOfRows()-1,0))>granularity*1000)) {
			datatable.addRow();
			datatable.setCell(datatable.getNumberOfRows()-1,0,ondate);
		}
		datatable.setCell(datatable.getNumberOfRows()-1,columnmap[rawdata.rows[i].value.sensor_name],parseFloat(rawdata.rows[i].value.calibrated_value.split(" ")[0]));
	}
	return datatable;
}


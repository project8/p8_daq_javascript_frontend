//I expect a few variables set up for me

//channel_couch_data=""; //the raw json from querying the channel table
//logger_couch_data=""; //the row json from querying the logger table


//--------------------------------------------------------------
//-----CommandTerminal-----
//--------------------------------------------------------------

//This is a unit that functions as a terminal
function CommandTerminal(megacontainer) {
	this.mydiv=document.createElement('div');
	document.getElementById(megacontainer).appendChild(this.mydiv);
	this.mydiv.setAttribute("class","container_box");
	this.mydiv.style.maxHeight="500px";
	this.mydiv.onclick=this.onClick.bind(this);
	this.textspace=document.createElement('div');
	this.mydiv.appendChild(this.textspace);
	this.textspace.setAttribute("class","terminal_text");
	this.textspace.onclick=this.onClick.bind(this);
	this.inputspace=document.createElement('input');
	this.inputspace.type="text";
	this.mydiv.appendChild(this.inputspace);
	this.inputspace.setAttribute("class","terminal_text");
	this.inputspace.onkeypress=this.onKeyPress.bind(this);
	this.last_autocomplete_state="";
	this.debuginfo="this is my debuginfo";
	this.last_command_revs={};
	command_listener_functions.push(this.commandListener.bind(this));
}

CommandTerminal.prototype.onClick=function(event) {
	this.inputspace.focus();
}

CommandTerminal.prototype.onKeyPress=function(event) {
	var keycode;
	if(window.event) {
		keycode=window.event.keyCode;
	} else {
		keycode=event.which;
	}
	if(keycode==13) {
		this.last_autocomplete_state="entered";
		this.textspace.innerHTML+="<span class='input_text'>";
		this.textspace.innerHTML+=this.inputspace.value;
		this.textspace.innerHTML+="</span><br>";
		var resp=this.parseCommand(this.inputspace.value);
		if(resp!="") {
			this.textspace.innerHTML+="<span class='error_text'>"+resp+"</span><br>";
		}
		this.inputspace.value="";
	}
}

CommandTerminal.prototype.parseCommand=function(command) {
	var that=this;
	var words=command.split(" ");
	if(words[0]=="get") {
		var that=this;
		send_dripline_get_command(words[0],words[1],this.handleSentCommand.bind(this),null);
	} else if(words[0]=="set") {
		return "set not handled.  Fix this.";
	} else if(words[0]=="run") {
		//syntax is run (rate in mhz) (duration in ms) [filename]
		if(words.length<3) { //correct not enough arguments
			return "syntax for run is: run (rate in Mhz) (duration in ms) [filename]";
		}
		var filename;
		if(words.length==3) { //generate filename if not present
			var rightnow=new Date();
			var filename="data_"+rightnow.getFullYear()+"-"+pad2(rightnow.getMonth())+"-"+pad2(rightnow.getDate())+" "+pad2(rightnow.getHours())+":"+pad2(rightnow.getMinutes())+":"+pad2(rightnow.getSeconds());
		} else filename=words[3];
		//add /data/ if not present
		if(filename.indexOf("/data/")!=0) {
			filename="/data/"+filename;
		}
		//call the command
		send_dripline_command({"do":"run","output":filename,"rate":words[1],"duration":words[2]},this.handleSentCommand.bind(this),null);
	} else {
		return "verb not recognized";
	}
	return "";
}

CommandTerminal.prototype.handleSentCommand=function(data) {
	this.last_command_revs[data["id"]]=data["rev"];
}

CommandTerminal.prototype.commandListener=function(data) {
//	alert("command received "+JSON.stringify(data)+" and my last command revs is "+JSON.stringify(this.last_command_revs));
	var that=this;
	for(var elem in this.last_command_revs) {
		if((data.results[0].id==elem)&&(data.results[0]["changes"][0]["rev"]!=this.last_command_revs[elem])) {
			$.couch.db(dripline_command_database).openDoc(data.results[0].id,{
				success: function(docdata) {
					that.textspace.innerHTML+="<span class='response_text'>"
						+docdata["command"]["channel"]+" "
					//	+resultToPrintable(docdata["result"],2)+" "
						+resultToPrintable(docdata["final"],2)
						+"</span><br>";
						//if this was a run, go ahead and get a power spectrum
					if(docdata["command"]["output"]!=null) {
						send_dripline_command({"do":"run","subprocess":"powerline","input":docdata["command"]["output"]},null,null);
					}
				},
				error: function(docdata) {
					alert("error getting data: "+JSON.stringify(data));
				}
				});
		}
	}
}

//-------------------------------------------
//-----Channel Table----
//-------------------------------------------

//a table of channels with last read values

function ChannelTable(megacontainer) {
	this.mydiv=document.createElement('div');
	document.getElementById(megacontainer).appendChild(this.mydiv);
	this.mydiv.setAttribute("class","container_box");
	this.title=document.createElement('h2');
	this.title.style.textAlign="center";
	this.title.innerHTML="Channels";
	this.mydiv.appendChild(this.title);
	this.channeldiv=document.createElement('div');
	this.mydiv.appendChild(this.channeldiv);
	this.channel_display_table = new google.visualization.Table(this.channeldiv);
	//extract the information I want in table fomat
	var columnnames=new Array();
	columnnames[0]="name";
	columnnames[1]="last reading";
	var columntypes=new Array();
	columntypes[0]="string";
	columntypes[1]="string";
	this.channel_table=convert_couch_to_gviz(channel_couch_data,columntypes,columnnames);
	this.channel_display_table.draw(this.channel_table);
	//now add a listener for changed readings
	command_listener_functions.push(this.onCommandReceived.bind(this));
}

ChannelTable.prototype.onCommandReceived=function(data) {
	$.couch.db(dripline_command_database).openDoc(data.results[0].id,{
		success: function(docdata) {
			var was_changed=false;
			for(var i=0;i<this.channel_table.getNumberOfRows();i++) {
				if(this.channel_table.getValue(i,0)==docdata["command"]["channel"]) {
					if("final" in docdata) {
						this.channel_table.setValue(i,1,docdata["final"]);
						was_changed=true;
						}
				}
			}
			if(was_changed==true)
				this.channel_display_table.draw(this.channel_table);
		}.bind(this),
		error: function(docdata) {} //do nothing for now
		});
}


//----------------------------------------------------------
//--------------LoggerPlot
//----------------------------------------------------------
//a module with a plot of logged channels

//make sure date components are two digits longe
function pad2(input) {
	var ret=new String(input);
	if(ret.length<2) return "0"+ret;
	return ret;
}

function LoggerPlot(megacontainer) {
	this.mydiv=document.createElement('div');
	this.mydiv.setAttribute("class","container_box");
	document.getElementById(megacontainer).appendChild(this.mydiv);
	//keep the plot here
	this.plotspace=document.createElement('div');
	this.plotspace.style.width="500px";
	this.plotspace.style.height="400px";
	//time range here
	this.timerange=document.createElement('div');
	this.start_time_input=document.createElement('input');
	this.start_time_input.type="text";
	var rightnow=new Date();
	rightnow.setSeconds(rightnow.getSeconds()-3*60*60);
	this.start_time_input.value=rightnow.getFullYear()+"-"+pad2(rightnow.getMonth()+1)+"-"+pad2(rightnow.getDate())+" "+pad2(rightnow.getHours())+":"+pad2(rightnow.getMinutes())+":"+pad2(rightnow.getSeconds());
//	this.start_time_input.value="2012-05-21 18:00:00";
	this.start_time_input.onkeyup=this.onTimeEntryKeyUp.bind(this);
	this.timerange.appendChild(document.createTextNode("from:   "));
	this.timerange.appendChild(this.start_time_input);
	this.stop_time_input=document.createElement('input');
	this.stop_time_input.type="text";
	this.stop_time_input.value="now";
	this.stop_time_input.onkeyup=this.onTimeEntryKeyUp.bind(this);
	this.timerange.appendChild(document.createTextNode("until:   "));
	this.timerange.appendChild(this.stop_time_input);

	this.graphoptionsspace=document.createElement('div');
	this.logcheckbox=document.createElement('checkbox');
	this.logcheckbox.setAttribute("class","wordbutton");
	this.logcheckbox.innerHTML="Log Scale";
	this.logcheckbox.onclick=this.onLogScaleBoxClick.bind(this);
	this.logscale=false;
	this.graphoptionsspace.appendChild(this.logcheckbox);

	//and data selection here
	this.selectspace=document.createElement('div');
	this.mydiv.appendChild(this.plotspace);
	this.mydiv.appendChild(this.graphoptionsspace);
	this.mydiv.appendChild(this.timerange);
	this.mydiv.appendChild(this.selectspace);
	//set up data selection space
	this.selections=new Array();
	var that=this;
	for(var i=0;i<logger_couch_data.rows.length;i++) {
		var channel_name=logger_couch_data.rows[i].value["channel"];
		var thischeckbox=document.createElement('div');
		thischeckbox.setAttribute("class","wordbutton");
		thischeckbox.setAttribute("name",channel_name);
		thischeckbox.innerHTML=channel_name;
		thischeckbox.onclick=this.onSelectCheckboxClick.bind(this);
		this.selectspace.appendChild(thischeckbox);
		this.selections.push(thischeckbox);
	}
	//list of channels in the plot
	this.channel_names=[];
//	this.start_time="2012-05-21 18:00:00";
//	this.end_time="now";
	this.granularity=60; //in seconds
	
	this.myplot=new Dygraph.GVizChart(this.plotspace);
	dripline_log_listener_functions.push(this.onLoggerUpdate.bind(this));



//	this.myplot.updateOptions({axisLabelColor: "rgb(255,129,0)"});
	//this.myplot=new Dygraph.GVizChart(this.mydiv);
//	this.myplot=new Dygraph.GVizChart(document.getElementById('placewhereplotgoes'));
}

LoggerPlot.prototype.rebuildSelectedChannels=function() {
	this.channel_names=[];
	for(var i=0;i<this.selections.length;i++) {
		if(this.selections[i].value=="selected") {
			this.channel_names.push(this.selections[i].getAttribute("name"));
		}
	}
//	alert(JSON.stringify(this.channel_names));
}

LoggerPlot.prototype.regetdata=function() {
	queryLoggerData(this.start_time_input.value,this.stop_time_input.value,this.processdata.bind(this));
}

LoggerPlot.prototype.processdata=function(data) {
	this.processed_data=buildGvizFromLoggedData(data,this.channel_names,this.granularity);
	this.redraw();
}

LoggerPlot.prototype.redraw=function() {
	this.myplot.draw(this.processed_data,{axisLabelColor: "rgb(255,129,0)",yAxisLabelWidth: 60,strokeWidth: 2,logscale: this.logscale});
}

LoggerPlot.prototype.onTimeEntryKeyUp=function(event) {
	var keycode;
	if(window.event) {
		keycode=window.event.keyCode;
	} else {
		keycode=event.which;
	}
	if(keycode==13) {
		this.regetdata();
		//remove focus from textbox
		if(!event) var event=window.event;
		var targ;
		if(event.target) targ=event.target;
		else targ=event.srcElement;
		targ.blur();
	}
}

LoggerPlot.prototype.onLogScaleBoxClick=function(e) {
	if(!e) var e=window.event;
	var targ;
	if(e.target) targ=e.target;
	else targ=e.srcElement;
	if(targ.value=="selected") {
		targ.style.background="#000000";
		targ.value="notselected";
		this.logscale=false;
	} else {
		targ.style.background="#505050";
		targ.value="selected";
		this.logscale=true;
	}
//	this.rebuildSelectedChannels();
	this.regetdata();
}

LoggerPlot.prototype.onSelectCheckboxClick=function(e) {
	if(!e) var e=window.event;
	var targ;
	if(e.target) targ=e.target;
	else targ=e.srcElement;
	if(targ.value=="selected") {
		targ.style.background="#000000";
		targ.value="notselected";
	} else {
		targ.style.background="#505050";
		targ.value="selected";
	}
	this.rebuildSelectedChannels();
	this.regetdata();
}

LoggerPlot.prototype.onLoggerUpdate=function(data) {
//	alert("onloggerupdate");
	if(this.stop_time_input.value!="now") return; //do nothing unless told to update
	if(this.processed_data==undefined) return; //don't look until something is selected
//	alert("gonna do something");
	var that=this;
	for(j=0;j<data.results.length;j++) {
	$.couch.db(dripline_logger_database).openDoc(data.results[j].id,{
		success: function(docdata) {
			if(docdata["timestamp_localstring"]==undefined) return;
			var ondate=driplineStringToDate(docdata["timestamp_localstring"]);
			var sensor=docdata["sensor_name"];
			//var value=docdata["final_value"];
			var value=docdata["calibrated_value"];
			for(var i=0;i<that.processed_data.getNumberOfColumns();i++) {
				if(that.processed_data.getColumnId(i)==sensor) {
					if((that.processed_data.getNumberOfRows()==0)||((ondate.getTime()-that.processed_data.getValue(that.processed_data.getNumberOfRows()-1,0))>that.granularity*1000)) {
					that.processed_data.addRow();
					that.processed_data.setCell(that.processed_data.getNumberOfRows()-1,0,ondate);
					}
					that.processed_data.setCell(that.processed_data.getNumberOfRows()-1,i,parseFloat(value.split(" ")[0]));
				}
			}
			that.redraw();
		},
		error: function(docdata) {
		}
		});
	}
}

//------------------------------------------------
//          Spectrum Display
//------------------------------------------------
//Shows the last spectrum generated

function SpectrumDisplay(megacontainer) {
	this.mydiv=document.createElement('div');
	this.mydiv.setAttribute("class","container_box");
	document.getElementById(megacontainer).appendChild(this.mydiv);
	//keep the data here
	this.toplot=new Array();
	//keep the plot here
	this.plotspace=document.createElement('div');
	this.plotspace.style.width="500px";
	this.plotspace.style.height="400px";
	this.mydiv.appendChild(this.plotspace);
	this.logscale=false;

	
	this.myplot=new Dygraph.GVizChart(this.plotspace);
	this.sampling_rate=400;
	command_listener_functions.push(this.commandListener.bind(this));
}

SpectrumDisplay.prototype.redraw=function() {
//	alert("drawing data: "+JSON.stringify(this.toplot));
	this.myplot.draw(
			this.toplot,
			{axisLabelColor: "rgb(255,129,0)",
			 yAxisLabelWidth: 60,
			 strokeWidth: 2,
			 xlabel: "Frequency (MHz)",
			 ylabel: "Power (dBm)",
			});
}

SpectrumDisplay.prototype.commandListener=function(data) {
	var that=this;
	$.couch.db(dripline_command_database).openDoc(data.results[0].id,{
		success: function(docdata) {
			if((docdata["command"]["subprocess"]=="powerline")||
                           (docdata["command"]["subprocess"]=="sweepline")) {
			if(docdata["final"]!=null)
			{
				//parse the data (starts as JSON array of powers)
				rawpower=JSON.parse(docdata["final"]);
				this.sampling_rate=rawpower["sampling_rate"];
				that.toplot=new Array();
//				alert("rawpower length is " +rawpower.length);
//				alert("rawpower is "+JSON.stringify(rawpower));
				lten=Math.log(10);
				for(var i=1;i<rawpower["data"].length-1;i++) {
					frequency_spacing=this.sampling_rate/(2*rawpower["data"].length);
					that.toplot.push([ i*frequency_spacing,10.0*Math.log(rawpower["data"][i])/lten]);
					//that.toplot.push([ i*frequency_spacing,rawpower["data"][i]]);
				}
//				alert("toplot length is " +toplot.length);
				that.redraw();
			}
			}
		},
		error: function(docdata) {
		}
		});
}





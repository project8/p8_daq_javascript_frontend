#!/bin/bash

if [ $# -lt 1 ]
then
	echo "usage: install.sh [legit|test]"
	exit 0
fi
if [ "$1" == "legit" ]
then
	targetdesign="legitdesign"
else
	targetdesign="testdesign"
fi
	

#targethost="localhost:5984"
targethost="p8admin:highs34s@p8portal.phys.washington.edu:5984"
targetdb="frontend_tests"
html_attachments=index.html
javascript_attachments="couch_gvis_interface.js dripline_js_interface.js modular_display.js dygraph-combined.js"
other_attachements="orbitron-medium-webfont.ttf orbitron-medium-webfont.eot"

#create design if necessary
curl -vX PUT http://$targethost/$targetdb/_design/$targetdesign --data-binary @$targetdesign.json
#get the latest revision
rev=`curl -s -X GET http://$targethost/$targetdb/_design/$targetdesign | sed 's/^.*rev":"\([^"]*\)".*$/\1/'`
#upload all the html_attachments
for file in $html_attachments; do
	rev=`curl -s -X GET http://$targethost/$targetdb/_design/$targetdesign | sed 's/^.*rev":"\([^"]*\)".*$/\1/'`
	curl -v -X PUT http://$targethost/$targetdb/_design/$targetdesign/$file?rev=$rev --data-binary @$file -H "Content-Type: text/html"
done
#upload all the javascript attachments
for file in $javascript_attachments; do
	rev=`curl -s -X GET http://$targethost/$targetdb/_design/$targetdesign | sed 's/^.*rev":"\([^"]*\)".*$/\1/'`
	curl -v -X PUT http://$targethost/$targetdb/_design/$targetdesign/$file?rev=$rev --data-binary @$file -H "Content-Type: text/javascript"
done
#upload all the other attachments
for file in $other_attachements; do
	rev=`curl -s -X GET http://$targethost/$targetdb/_design/$targetdesign | sed 's/^.*rev":"\([^"]*\)".*$/\1/'`
	curl -v -X PUT http://$targethost/$targetdb/_design/$targetdesign/$file?rev=$rev --data-binary @$file -H "Content-Type: unknown"
done
echo "installed to $targetdesign"

#!/bin/bash
mongoimport --db test --collection events --type json --file testData.json --jsonArray
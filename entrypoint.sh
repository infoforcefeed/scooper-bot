#!/bin/sh

#export TELEGRAM_TOKEN=nope
#export TELEGRAM_USER_ID=nope
#export IFF_SUBMISSION_SALT=nope

while getopts t:u:S: flag
do
    case "${flag}" in
        t) TELEGRAM_TOKEN=${OPTARG};;
        u) TELEGRAM_USER_ID=${OPTARG};;
        S) IFF_SUBMISSION_SALT=${OPTARG};;
    esac
done

echo "TOKEN: $TELEGRAM_TOKEN"
echo "USER ID: $TELEGRAM_USER_ID"
echo "SALT: $IFF_SUBMISSION_SALT"

npm start

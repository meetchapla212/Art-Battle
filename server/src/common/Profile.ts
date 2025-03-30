import VotingLogModel from '../models/VotingLog';
import EventModel from '../models/Event';

export const getProfile = async function (hash: string) {
    const results = await VotingLogModel.aggregate([
        {
            '$match': {
                'PhoneHash': hash,
                'Status': 'VOTE_ACCEPTED'
            }
        }, {
            '$group': {
                '_id': {
                    'EaselNumber': '$EaselNumber',
                    'RoundNumber': '$RoundNumber',
                    'EventId': '$EventId'
                },
                'ArtistName': {
                    '$push': '$ArtistName'
                },
                'EventName': {
                    '$push': '$EventName'
                },
                'DisplayPhone': {
                    '$push': '$DisplayPhone'
                },
                'createdAt': {
                    '$push': '$createdAt'
                },
                'VoteFactor': {
                    '$push': '$VoteFactor'
                }
            }
        }, {
            '$sort': {
                'createdAt': -1
            }
        }
    ]);

    const profileOutput: {
        'phoneNum': String,
        'totalVotes': Number,
        'totalEvents': Number,
        'Events': {
            [k: string]: {
                Date: String,
                EventName: String,
                Rounds: {
                    ArtistName: String,
                    Name: String
                }[],
                NumVotes: number,
                VoteFactor: number,
                Flag: string,
                VoteDots: string
            }
        }
        VoteFactor?: number;
    } = {
        'phoneNum': '',
        'totalVotes': 0,
        'totalEvents': 0,
        'Events': {},
    };
    let totalEvents = 0;
    let totalVotes = 0;
    profileOutput.VoteFactor = (results[0] && results[0].VoteFactor) || 0;
    for (let i = 0; i < results.length; i++) {
        if (profileOutput.phoneNum.length === 0) {
            profileOutput.phoneNum = results[i].DisplayPhone[0];
        }
        if (!profileOutput['Events'].hasOwnProperty(results[i]._id.EventId)) {
            const event = await EventModel.findById(results[i]._id.EventId)
                .select(['Country'])
                .populate('Country');
            profileOutput['Events'][results[i]._id.EventId] = {
                'Date': results[i].createdAt[0],
                'EventName': results[i].EventName[0],
                'Rounds': [],
                'NumVotes': 0,
                'VoteFactor': results[i].VoteFactor[0],
                'Flag': event.Country && event.Country.country_image,
                'VoteDots': ''
            };
            totalEvents++;
        }
        profileOutput['Events'][results[i]._id.EventId].NumVotes++;
        profileOutput['Events'][results[i]._id.EventId].VoteDots += '&#9673;';
        profileOutput['Events'][results[i]._id.EventId].Rounds.push({
            ArtistName: results[i].ArtistName[0],
            'Name': `Round ${results[i]._id.RoundNumber}`
        });
        totalVotes++;
    }
    profileOutput.totalVotes = totalVotes;
    profileOutput.totalEvents = totalEvents;
    return profileOutput;
};
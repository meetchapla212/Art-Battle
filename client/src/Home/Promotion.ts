import { DataOperationResult } from '../../../shared/OperationResult';

import { EventsDropDownInterface } from '../../../shared/EventDropDownDTO';
import { BusyTracker } from '../Utils/BusyTracker';
import { EventPhoneNumberInterface } from '../../../shared/EventPhoneNumberDTO';
import { PromotionLogsInterface , PromotionLogsDataInterface } from '../../../shared/PromotionLogsDTO';

import { Request } from '../Utils/GatewayFunctions';
import HomeScreenViewModel from './HomeScreenViewModel';


export class Promotion {
    public id: any;
    public title: string;
    public EID: string;
    public Phone: string;
    public Label: string;
    public counts: number ;
    public email: string ;
    public nickname: string ;
    public tempEventList: string[];
    public filterRegisterIds: KnockoutObservableArray<string> = ko.observableArray<string>([]);
    public Message: KnockoutObservable<string> = ko.observable<string>('');
    public ErrorMessage: KnockoutObservable<string> = ko.observable<string>();
    public displayMessage: KnockoutObservable<string> = ko.observable<string>();
    public events: KnockoutObservableArray<EventsDropDownInterface> = ko.observableArray<EventsDropDownInterface>([]);
    public eventPhoneNumbers: KnockoutObservableArray<EventPhoneNumberInterface> = ko.observableArray<EventPhoneNumberInterface>([]);
    public LoadingTracker: BusyTracker = new BusyTracker();
    public bids: KnockoutObservable<string> = ko.observable<string>();
    public voteCount: KnockoutObservable<string> = ko.observable<string>();
    public timelogs: KnockoutObservable<string> = ko.observable<string>();
    public notificationBySMS: KnockoutObservable<string> = ko.observable<string>();
    public notificationByiOS: KnockoutObservable<string> = ko.observable<string>();
    public notificationByAndroid: KnockoutObservable<string> = ko.observable<string>();
    public phoneNumber: KnockoutObservable<string> = ko.observable<string>();
    public message: KnockoutObservable<string> = ko.observable<string>();
    public smsRegType: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public appRegType: KnockoutObservable<boolean> = ko.observable<boolean>(false);

    public PhoneValues: KnockoutObservableArray<Promotion> = ko.observableArray<Promotion>([]);
    public selectedPhone: KnockoutReadonlyComputed<any> = ko.computed(() => {
        return ko.utils.arrayMap(this.PhoneValues(), (val: unknown) => {
            return val;
            // @ts-ignore
        }, this);


    });


    public filterGuestCount: KnockoutObservable<any> = ko.observable<any>();
    public promotionLogsData: KnockoutObservable<any> = ko.observable<any>();
    public promotionMessageLogsData: KnockoutObservable<any> = ko.observable<any>();
    public promotionMessagesVoteData: KnockoutObservable<any> = ko.observable<any>();

    public filterBids: KnockoutObservable<any> = ko.observable<any>();

    public searchEvents: KnockoutObservable<string> = ko.observable<string>();
    public registrationIDs: KnockoutObservable<any> = ko.observable<any>([]); // IF BID is 0, then use this
    public deviceCount: KnockoutObservable<any> = ko.observable<any>();
    public VM: HomeScreenViewModel;
    public constructor(VM: HomeScreenViewModel) {
        this.VM = VM;
        // this.reloadData();
        // this.bids(0);
        this.notificationBySMS.subscribe(async (n) =>  {
            this.deviceCount('0');
        });
        this.notificationByiOS.subscribe(async (n) =>  {
            this.deviceCount('0');
        });
        this.notificationByAndroid.subscribe(async (n) =>  {
            this.deviceCount('0');
        });
    }

    public LoadEvent(dto: EventsDropDownInterface) {
        this.id = dto._id;
        this.title = dto.title;
        this.EID = dto.EID;

    }

    public LoadPhoneNumber(dto: EventPhoneNumberInterface) {
        this.Phone = dto.phone;
        this.Label = dto.label;


    }

    public LoadPromotionLogData(dto: PromotionLogsDataInterface) {
        this.id = dto._id;
        this.counts = dto.count;
        this.email = dto.email;
        this.nickname = dto.nickname;
        this.phoneNumber(dto.phonenumber);
    }

    public async LoadEventDropdown(EventName: any): Promise<void> {
        // @ts-ignore
        const dtos = await this.LoadingTracker.AddOperation(Request<EventsDropDownInterface[]>(mp + '/api/promotion/event-list?eventName=' + EventName, 'GET'));
        this.events(dtos);
        // @ts-ignore
        jQuery(document).ready(() => {
            // @ts-ignore
            jQuery('.search-box-sel-all').SumoSelect({ csvDispCount: 3, selectAll: true, search: true, searchText: 'Enter here.', okCancelInMulti: true });
        });

    }


    public async LoadEventPhoneNumber(): Promise<void> {
        // @ts-ignore
        const dtos = await this.LoadingTracker.AddOperation(Request<EventPhoneNumberInterface[]>(mp + '/api/promotion-phonenumber', 'GET'));
        this.eventPhoneNumbers(dtos);
    }

    public async LoadPromotionLogs(): Promise<void> {
        // @ts-ignore
        const dtos = await this.LoadingTracker.AddOperation(Request<PromotionLogsDataInterface[]>(mp + '/api/promotion/logs', 'GET'));
        this.promotionLogsData(dtos);
    }

    public async LoadPromotionMessageLogs(): Promise<void> {
        // @ts-ignore
        const dtos = await this.LoadingTracker.AddOperation(Request<PromotionLogsDataInterface[]>(mp + '/api/promotion/message-logs', 'GET'));
        this.promotionMessageLogsData(dtos);
    }

    public async LoadPromotionTopVotesLogs(): Promise<void> {
        // @ts-ignore
        const dtos = await this.LoadingTracker.AddOperation(Request<PromotionLogsDataInterface[]>(mp + '/api/promotion/top-vote', 'GET'));
        this.promotionMessagesVoteData(dtos);
    }

    public async savePromotionForm(): Promise<void> {

        if (this.filterGuestCount() && typeof this.filterGuestCount() !== 'undefined') {
            const guestCount = JSON.parse(JSON.stringify(this.filterGuestCount()));

            if (this.VM.multipleSelectedOptionValues().length > 0 && guestCount.guestcount > 0) {



                let i;
                const dt = [];

                for (i = 0; i < this.VM.multipleSelectedOptionValues().length; i++) {
                    const data = {
                        'events': this.VM.multipleSelectedOptionValues()[i].id,
                        'Phonenumber': this.selectedPhone()[0],
                        'sms': (this.notificationBySMS()) ? true : false,
                        'ios': (this.notificationByiOS()) ? true : false,
                        'android': (this.notificationByAndroid()) ? true : false,
                        'message': this.Message(),
                        'registrationIds': this.filterRegisterIds() ? this.filterRegisterIds() : [],
                        'dt': (this.filterBids()) ? this.filterBids() : [],

                    };

                    dt.push(data);
                }
                // if (this.notificationBySMS() == 'true' || this.notificationByiOS() == 'true' || this.notificationByAndroid() == 'true') {
                // @ts-ignore
                    const result = await Request<DataOperationResult<PromotionLogsInterface>>(mp + '/api/promotion/save', 'POST', dt);
                    const notificationResult = await this.sendNotfications(this.filterRegisterIds());
                    // return notificationResult;

                    if (result.Success) {
                        //
                        alert('Notification sent ');
                        // window.location.reload();
                        // this.displayMessage('Notification Send Successfully');
                        // this.flash('success', { msg: 'Success! You are logged in.' });
                    } else {
                        this.displayMessage('An Error occurred');
                    }
                // } else {
                //     alert('Please select Notification By SMS, iOS or Andorid');
                // }


            } else {
                alert('Select Valid Events Or no guest available');
            }
        } else {
            alert('Select Valid Events Or Click on Refresh Result ');
        }

    }



    public async getGuestCount(data: any) {
        // alert('DATA ==>>>' + JSON.stringify(data));
        if (data.length > 0) {
            const result = await Request<{
                'Success': boolean;
                'registerationIDs': string[];
                // @ts-ignore
            }>(mp + '/api/promotion/guest-count', 'POST', data);
            if (result.Success) {
                /*let res = JSON.parse(JSON.stringify(result));
                res = JSON.parse(JSON.stringify(res));*/
                this.registrationIDs(result.registerationIDs);
                return result;
            } else {
                this.ErrorMessage('An Error occurred');
            }
        } else {
            return { Success: false, guest: 0 };
        }


    }

    public async getFilterGuestCount(data: any) {
        if (data.length > 0) {
            let bd = '0';
            if (this.bids() && typeof this.bids() !== 'undefined') {
                bd = this.bids();
            }
            let voteCount = '0';
            if (this.voteCount() && typeof this.voteCount() !== 'undefined') {
                voteCount = this.voteCount();
            }

            let tm = '0';
            if (this.timelogs() && typeof this.timelogs() !== 'undefined') {
                tm = this.timelogs();
            }

            const dt = {
                'data': data,
                'bids': bd,
                'timelogs': tm,
                'sms-reg': this.smsRegType(),
                'app-reg': this.appRegType(),
                'voteCount': voteCount
            };
            this.filterBids('');
            this.filterRegisterIds([]);
            // if (dt.bids == '0') {

            //      // console.log('this.registrationIDs() ===>>>>', this.registrationIDs().length);
            //      // this.filterBids(this.registrationIDs().length);
            //     this.filterRegisterIds(this.registrationIDs());
            //     this.filterGuestCount({'guestcount': this.registrationIDs().length});

            // } else {
            // @ts-ignore
                let result: any = await Request<DataOperationResult<PromotionLogsInterface>>(mp + '/api/promotion/filter-guest-count', 'POST', dt);
                this.filterGuestCount(result);
                if (result.Success) {
                    result = JSON.parse(JSON.stringify(result));
                    result = JSON.parse(JSON.stringify(result));
                    this.filterBids(result.guest);
                    // console.log('Here ===>>>', result);
                    this.filterRegisterIds([]);
                    this.filterRegisterIds(result.registrationids);
                    // console.log('filterRegisterIds ===>>>', this.filterRegisterIds);

                } else {
                    this.ErrorMessage('An Error occurred');
                }
           // }
        } else {
            alert('Please select Events');
        }

    }

    public async sendNotfications(registrationIDs: any) {
         // registrationIDs = this.filterRegisterIds() ;
        if (registrationIDs.length > 0) {
            const dt = {
                registrationIDs: registrationIDs,
                'sms': (this.notificationBySMS()) ? true : false,
                'ios': (this.notificationByiOS()) ? true : false,
                'android': (this.notificationByAndroid()) ? true : false,
                'Phonenumber': this.selectedPhone()[0],
                'message': this.Message(),
            };
            // @ts-ignore
            const result: any = await Request<DataOperationResult<PromotionLogsInterface>>(mp + '/api/promotion/send-notification', 'POST', dt);
        } else {

            alert({ Success: false, guest: 0 });
        }

    }


    public async getDeviceCount () {
        const registrationIDs = this.filterRegisterIds();
        // console.log('registrationIDs ==>>>', registrationIDs);
        // if (registrationIDs.length > 0) {
        //     const dt = {
        //         registrationIDs: registrationIDs
        //     };
        //     const result: any = await Request<DataOperationResult<PromotionLogsInterface>>('/api/promotion/device-count', 'POST', dt);
        // } else {

        //     alert('Please select events');
        // }
    }


}

export default Promotion;
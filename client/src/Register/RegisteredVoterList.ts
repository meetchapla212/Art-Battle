import RegistrationDTO from '../../../shared/RegistrationDTO';
import { Request } from '../Utils/GatewayFunctions';
import { BusyTracker } from '../Utils/BusyTracker';
import { RegistrationsResponse } from '../../../shared/RegistrationsReponse';
import Registrant from './Registrant';

export class RegisteredVoterList {
    public Voters: KnockoutObservableArray<Registrant> = ko.observableArray<Registrant>();
    public FilteredRegistrations: KnockoutReadonlyComputed<Registrant[]>;
    public Filter: KnockoutObservable<string> = ko.observable<string>();
    public LoadingTracker: BusyTracker = new BusyTracker();
    public EventId: string;

    public constructor(eventId: string, private _voterSelectedCallback: (voter: RegistrationDTO) => void) {
        this.EventId = eventId;
        // @ts-ignore
        this.LoadingTracker.AddOperation(Request<RegistrationsResponse[]>(`${mp}/api/event/${eventId}/registrations`, 'GET')
            .then((dtos) => {
                const registeredVoters: RegistrationsResponse[] = dtos.map(r => {
                    if (!r.Hash) {
                        // Setting empty hash
                        r.Hash = '';
                    }
                    r.PhoneNumber = (r.PhoneNumber || r.Email).toString();
                    return r;
                })
                    .sort((a: RegistrationsResponse, b: RegistrationsResponse) => {
                        if (a.PhoneNumber && b.PhoneNumber) {
                            return a.PhoneNumber.compareTo(b.PhoneNumber, true);
                        } else {
                            return 1;
                        }
                    });
                for (let i = 0; i < registeredVoters.length; i ++) {
                    this.Voters().push(new Registrant(registeredVoters[i], eventId));
                }
                this.Voters.notifySubscribers();
            })).catch(e => console.error(e));
        this.ConfigureComputed();
    }

    public UpdateRegistration(dto: RegistrationsResponse) {
        const registrations = this.Voters();
        const eventRegistration = registrations.find(r => {
            return r.PhoneNumber() == dto.PhoneNumber;
        });
        if (eventRegistration) {
            registrations.splice(registrations.indexOf(eventRegistration), 1, new Registrant(dto, this.EventId));
            this.Voters(registrations);
        } else {
            this.Voters.push(new Registrant(dto, this.EventId));
        }
    }

    public Selected(dto: RegistrationDTO) {
        this._voterSelectedCallback(dto);
    }

    private ConfigureComputed(): void {
        this.FilteredRegistrations = ko.computed(() => {
            if (this.Filter()) {
                const filter = this.Filter().toLocaleLowerCase();
                return this.Voters()
                    .filter(r => {
                        r.PhoneNumber = (r.PhoneNumber || r.Email);
                        return (r.Email() && r.Email().toLocaleLowerCase().contains(filter)) ||
                            (r.PhoneNumber() && r.PhoneNumber().toLocaleLowerCase().contains(filter)) ||
                            (r.RegionImage && r.RegionImage.toLocaleLowerCase().contains(filter));
                    });
            } else {
                return this.Voters();
            }
        });
    }
}

export default RegisteredVoterList;
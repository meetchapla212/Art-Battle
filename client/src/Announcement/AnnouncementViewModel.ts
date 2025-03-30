import * as ko from 'knockout';
export class AnnouncementViewModel {
    public Message: KnockoutObservable<string> = ko.observable<string>('');
    public disableSubmit: KnockoutObservable<boolean> = ko.observable<boolean>(false);

    messageClick(message: string) {
        this.Message(message);
    }

    submitForm(form: HTMLFormElement) {
        $(form).find('button').addClass('disabled');
        if (!this.disableSubmit()) {
            // submit is allowed
            this.disableSubmit(true);
            return true;
        } else {
            return false;
        }
    }
}

export default AnnouncementViewModel;
export class stringTemplateSource {
    public template: string | Node;

    constructor(template: string | Node) {
        this.template = template;
    }

    data(key: string) {
        console.log('data', key);
    }

    text() {
        return this.template.toString();
    }
}
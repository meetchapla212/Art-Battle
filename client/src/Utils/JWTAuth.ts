export class JWTAuth {
    private _token: string;
    /**
     * Save Token in Local Storage
     */
    public set(token: string) {
        this._token = token;
    }

    public get(): string {
        return this._token;
    }
}
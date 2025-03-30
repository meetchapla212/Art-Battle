
// export function MakeRequestGeneric<T>(url: string, method: 'GET' | 'PUT' | 'POST' | 'DELETE', data?: Object): JQueryPromise<T> {
//     const options: JQueryAjaxSettings = <JQueryAjaxSettings>{};
//     options.data = data && ko.toJSON(data);

//     options.dataType = 'json';
//     options.contentType = 'application/json';

//     options.type = method;

//     XMLHttpRequest; xhr = new XMLHttpRequest();
//     return request;
// }

export async function Request<T>(url: string, method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH', data?: Object, progressCb?: (n: number) => void, token?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('progress', function(evt) {
            if (evt.lengthComputable) {
                const percentComplete = evt.loaded / evt.total;
                if (progressCb instanceof Function) {
                    progressCb(percentComplete);
                }
            }
        }, false);
        xhr.onreadystatechange = (event) => {
            if (xhr.readyState !== 4) return;
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.response)); // OK
            } else {
                // Error
                try {
                    reject(JSON.parse(xhr.response));
                }
                catch (e) {
                    reject({
                        message: xhr.statusText + xhr.response,
                        status: xhr.status,
                        code: 'internal_err'
                    });
                }
            }
        };

        xhr.open(method, url, true); // Async
        xhr.setRequestHeader('Content-Type', 'application/json');
        if (token && token.length > 0) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        data ? xhr.send(JSON.stringify(data)) : xhr.send();
    });
}
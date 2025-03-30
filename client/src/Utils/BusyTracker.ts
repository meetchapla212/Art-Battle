export class BusyTracker {
    public Busy: KnockoutReadonlyComputed<boolean>;

    private _tasks: KnockoutObservableArray<string> = ko.observableArray<string>();
    private _operations: KnockoutObservableArray<Promise<Object>> = ko.observableArray<Promise<Object>>();

    public constructor() {
        this.ConfigureDependentObservables();
    }

    private ConfigureDependentObservables(): void {
        this.Busy = ko.computed({
            owner: this,
            read: () => {
                return this._tasks().length + this._operations().length > 0;
            }
        });
    }

    public AddTask(task: string): void {
        /// <param name="task" type="String">
        /// Identifies the task being performed that is keeping the tracker busy
        /// </param>
        if (!this._tasks().contains(task)) {
            this._tasks.push(task);
        }
    }

    public AddOperations(operations: Promise<Object>[]): void {
        /// <param name="operations" type="Array">
        /// </param>
        operations.forEach((operation) => {
            this.AddOperation(operation);
        });
    }

    public async AddOperation<T>(operation: Promise<T>): Promise<T> {
        /// <param name="operation" type="JQueryPromise">
        /// </param>
        /// <returns type="JQueryPromise"></returns>
        const existingOperation = ko.utils.arrayFirst(this._operations(), (listOperation) => {
            return listOperation === operation;
        }, this);
        if (existingOperation == null) {
            this._operations.push(operation);
            operation.then(() => {
                this._operations.remove(operation);
            }).catch((e) => {
                console.error(e);
                this._operations.remove(operation);
            });
        }
        return operation;
    }

    public TaskComplete(task: string): void {
        /// <param name="task" type="String">
        /// </param>
        if (this._tasks().contains(task)) {
            this._tasks.remove(task);
        }
    }

    public ClearTasks(): void {
        this._tasks.removeAll();
    }

    public HasTask(taskName: string): boolean {
        /// <param name="taskName" type="String">
        /// </param>
        /// <returns type="Boolean"></returns>
        return this._tasks().contains(taskName);
    }

}

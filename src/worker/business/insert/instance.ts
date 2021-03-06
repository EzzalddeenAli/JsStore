import { Base } from "../base";
import { InsertQuery, IError, API } from "../../../common/index";
import { Table } from "../../model/index";
import { promiseAll, promise } from "../../helpers/index";
import { QueryHelper } from "../query_helper";

export class Instance extends Base {
    private valuesAffected_ = [];
    query: InsertQuery;
    table: Table;

    constructor(query: InsertQuery, onSuccess: (rowsInserted: number) => void, onError: (err: IError) => void) {
        super();
        this.onError = onError;
        this.query = query;
        this.onSuccess = onSuccess;
        this.tableName = this.query.into;
    }

    execute() {
        const queryHelper = new QueryHelper(API.Insert, this.query);
        queryHelper.checkAndModify().then(() => {
            this.query = queryHelper.query;
            this.insertData_(this.query.values);
        }).catch(this.onError);
    }

    private onTransactionCompleted_ = () => {
        if (this.error == null) {
            this.onSuccess(this.query.return === true ? this.valuesAffected_ : this.rowAffected);
        }
        else {
            this.onError(this.error);
        }
    }

    private onQueryFinished_() {
        if (this.isTransaction === true) {
            this.onTransactionCompleted_();
        }
    }

    private insertData_(values: any[]) {

        let objectStore: IDBObjectStore;
        let onInsertData;
        let addMethod;

        if (this.query.return) {
            onInsertData = (value) => {
                this.valuesAffected_.push(value);
            };

        }
        else {
            onInsertData = (value) => {
                ++this.rowAffected;
            };
        }

        this.createTransaction([this.tableName], this.onTransactionCompleted_);
        objectStore = this.transaction.objectStore(this.tableName);
        if (this.query.upsert) {
            addMethod = (value) => {
                return objectStore.put(value);
            };
        }
        else {
            addMethod = (value) => {
                return objectStore.add(value);
            };
        }
        promiseAll(
            values.map(function (value) {
                return promise(function (res, rej) {
                    const addResult = addMethod(value);
                    addResult.onerror = rej;
                    addResult.onsuccess = function () {
                        onInsertData(value);
                        res();
                    };
                });
            })
        ).then(() => {
            this.onQueryFinished_();
        }).catch((err) => {
            this.transaction.abort();
            this.onErrorOccured(err);
        });
    }
}
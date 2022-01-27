import { ActivatedRoute } from '@angular/router';
import { Component, OnInit, Input, Output, OnDestroy, EventEmitter } from '@angular/core';
import { timer, Subscription } from 'rxjs';
import { ConversationApi } from 'shared/sdk';
import { PreloaderService } from 'shared/services/preloader.service';
import { AppStateService } from 'shared/services/app-state.service';
import { SharedService } from 'shared/services/pms/shared.services';
import { ConfirmDialogService } from 'shared/services/confirm-dialog.service';
import { AlertService } from 'shared/services/alert.service';
import { MessengerApiService } from '../../messenger-api.service';
import { MessengerSocketService } from '../../../messenger-socket.service';

@Component({
  selector: 'app-conversation-messages',
  templateUrl: './conversation-messages.component.html',
  styleUrls: ['./conversation-messages.component.scss']
})
export class ConversationMessagesComponent implements OnInit, OnDestroy {
  @Input() set data(e) {
    this.initPage(e);
  };

  @Input() set newMsgItem(e) {
    this.updateNewMsgContent(e);
  }

  @Input() set searchtext(e) {
   this.searchMsgContent(e);
  }

  @Input() moduleName: any = 'person';
  @Output() replyMessage = new EventEmitter();

  userData: any;
  selectedItem: any;
  listData: any = [];
  listBackupData: any = [];
  currentUser: any;
  workerId: any;
  newMsg = false;
  activeTabId: any;
  filterBySfdcId: any;
  infoMsg = false;
  readunread:boolean = false;
  lstmsgid : string;
  conversationSubscription: Subscription;
  private _sub: Subscription;
  private _sub2: Subscription;
  constructor(private _conversationApi: ConversationApi,
    private _preloaderService: PreloaderService,
    private route: ActivatedRoute,
    private _appState: AppStateService,
    private _sharedService: SharedService,
    public _confirmDialogService: ConfirmDialogService,
    private _alertService: AlertService,
    private _messengerApi: MessengerApiService,
    private _messengerSocket: MessengerSocketService
  ) {
    this.onpageLoad();
    this.listData = [];
    this._sub = this._messengerSocket.getConversationMessages().subscribe(res => {
       //console.log('val from socket >> ', res);
      let message = res['data'];
      if (!this.listBackupData.some(x => x.message_id === message.message_id)) {
        if (message.sent_by.id === this.userData.getValue().user.sfdcId) {
          message['initatedByME'] = true;
        }
        this.listBackupData.push(message);
        // this.listData.push(message);
        this.infoMsg = false;
        this.readunread = false;
      }
    });
    this._sub2 = this._messengerSocket.getChatEvents().subscribe(val => {
       console.log('chat eve >> ', val);
       console.log("lastmessagesid",this.selectedItem)
       if(val.object === 'message' && val.action === 'seen' ){
           this.readunread = true;
           this.lstmsgid = val.data;
       }
      if (val.object === 'message' && val.action === 'delete') {
        if (val.data.conversation_id === this.selectedItem.conversation_id) {
          let indexOfDeletedMessage = '';
          let deletedMessage = this.listBackupData.find((x, index) => {
            if (x.message_id === val.data.message_id) {
              indexOfDeletedMessage = index;
              return x;
            }
          });
          // if(Object.keys(deletedMessage).length) {

          // }
          this.listBackupData.splice(indexOfDeletedMessage, 1);
          // console.log('deletedMessage >> ', deletedMessage, indexOfDeletedMessage);
        }
      }
    });
  }

  ngOnInit() {
    this.userData = this._appState.getAppState();
  }

  /**
   * set page information
   * @param e Selected data
   */
  initPage(e) {
    this.newMsg = false;
    this.infoMsg = false;
    this.selectedItem = e;
    this.listData = [];
    if (e && Object.keys(e).length) {
      this.getConversation();
    }
    // this.subscribeConversation();
  }

  /*
  timer takes a second argument, how often to emit subsequent values
  in this case we will emit first value after 0 second and subsequent
  values every 10 seconds after
*/
  subscribeConversation() {
    this.unSubscribeSubscription();
    this.conversationSubscription = timer(0, 10000).subscribe(val => this.getConversation());
  }



  /**
   * Load page information
   */
  onpageLoad() {
    this.currentUser = JSON.parse(localStorage.getItem('appData'));
    if (this.currentUser && this.currentUser.user && this.currentUser.user.workers && this.currentUser.user.workers.length) {
      this.workerId = this.currentUser.user.workers[0].sfdcId;
    }
    this.activeTabId = this.route.snapshot.params['subtabId'];
  }

  /**
   * Get conversation list 
   * @param loader True || False
   */
  // getConversation() {
  //   if (this.selectedItem && this.selectedItem.PgMO_Conversation__c) {
  //     if (!this.listData.length) {
  //       this._preloaderService.showPreloader();
  //     }
  //     let whereObj;
  //     if (this.filterBySfdcId) {
  //       whereObj = { sfdcId: this.selectedItem.PgMO_Conversation__c };
  //     } else {
  //       whereObj = { Parent_Conversation__c: this.selectedItem.PgMO_Conversation__c, sfdcId: { neq : null }};
  //     }

  //     if (this.listData && this.listData.length) {
  //       const lastCon = this.listData[this.listData.length - 1];
  //       whereObj['id'] = {gt : lastCon.id}
  //       this.newMsg = true;
  //     } else {
  //       this.newMsg = false;
  //       delete whereObj['id'];
  //     }
  //     whereObj['IsServiceODelete'] = null;
  //     const filterObj = {
  //       where: whereObj,
  //       fields: ['id', 'sfdcId', 'Name', 'Reply__c', 'Initated_By_Member__c', 'Original_Post__c', 'Title__c', 'Message__c',
  //         'Parent_Conversation__c', 'Parent_Reply_Conversation__c', 'Main_Message_Reply_Conversation__c', 'documentCount', 'createdAt'
  //       ],
  //       include: [{
  //         relation: 'worker',
  //         scope: {
  //           fields: ['id', 'Contact__c', 'Name'],
  //           include: [{
  //             relation: 'user',
  //             scope: {
  //               fields: ['id', 'sfdcId', 'firstname', 'lastname', 'profileImage', 'url', 'accessType']
  //             }
  //           },
  //           {
  //             relation: 'contact',
  //             scope: {
  //               fields: ['sfdcId', 'Gender__c', 'Title', 'Department']
  //             }
  //           }
  //         ]
  //         }
  //       },
  //       {
  //         relation: 'ReplyId',
  //         scope: {
  //           fields: ['sfdcId', 'Message__c', 'Initated_By_Member__c', 'createdAt'],
  //           include: [{
  //             relation: 'worker',
  //             scope: {
  //               fields: ['id', 'Contact__c', 'Name']
  //             }
  //           }]
  //         }
  //       }]
  //     }
  //     this._conversationApi.find(filterObj).subscribe(res => {
  //       this._preloaderService.hidePreloader();
  //       this.prePairData(res);
  //       this.updateLeftCard();
  //       // lastC
  //     }, err => {
  //         console.log(err);
  //         this._preloaderService.hidePreloader();
  //       });
  //   }
  // }

  getConversation() {    
    if (this.selectedItem && this.selectedItem.conversation_id) {
      this._preloaderService.showPreloader();
      let filterObj = {
        conversation_id: this.selectedItem.conversation_id
      };
      this._messengerApi.getMessages(filterObj).subscribe(res => {
        this._preloaderService.hidePreloader();
        if (res && res['data'] && res['data'].length) {
          this.listData = res['data'];
          this.listData = this.listData.map(x => {
            if (x.sent_by.id === this.userData.getValue().user.sfdcId) {
              x.initatedByME = true;
            }
            return x;
          });
        } else {
          this.listData = [];
        }
        this.listBackupData = this.listData;
        this.infoMsg = this.listData.length ? false : true;
      }, err => {
        console.log(err);
        this._preloaderService.hidePreloader();
      });
this.readunread = false;
    } else {
      this.listData = [];
      this.listBackupData = this.listData;
    }
  }

  /**
   * Update Last Msg info
   */
  updateLeftCard() {
    if (this.newMsg) {
      const lastCon = this.listData[this.listData.length - 1];
      if (lastCon) {
        this.selectedItem['countConversation'] = this.listData.length;
        this.selectedItem['lastConversation'] = {
          createdAt: lastCon.createdAt,
          message: lastCon.Message__c,
          workerName: lastCon.worker.Name,
          workerSfdcId: lastCon.Initated_By_Member__c
        };
      }
    }
  }

  /**
   * Get latest msg from backend
   * @param e New msg Info
   */
  updateNewMsgContent(e) {
    if (e) {
      this.newMsg = true;
      if (!this.selectedItem.PgMO_Conversation__c && e.sfdcId) {
        this.selectedItem.PgMO_Conversation__c = e.sfdcId;
        this.filterBySfdcId = true;
      } else {
        this.filterBySfdcId = false;
      }
      //this.getConversation(false);
    }
  }

  /**
   * filter conversation
   * @param e search Content
   */
  searchMsgContent(e) {
    if (this.listBackupData && this.listBackupData.length && e) {
      this.listData = this.listBackupData.filter(col => col.message.toLowerCase().indexOf(e.toLowerCase()) !== -1);
      this.infoMsg = this.listData.length ? false : true;
    } else {
      this.getConversation();
    }
  }

  /**
 * End All Subscribe Subscription Related To This Page
 */
  unSubscribeSubscription() {
    if (this.conversationSubscription) {
      this.conversationSubscription.unsubscribe();
    }
  }

  onReply(item) {
    this.replyMessage.emit(item);
  }

  onDelete(message) {
    const _thisEvent = this;
    this.currentUser = this._appState.getAppState();
    this._confirmDialogService.confirmThis(
      {
        title: 'Warning!!',
        titleIcon: 'mdi mdi-alert text-warning',
        text: 'Do you really want to delete the Message ?'
      },
      () => {
        let deleteObj = {
          message_id: message.message_id,
          socket_push: {
            action: 'delete',
            data: {
              message_id: message.message_id,
              conversation_id: this.selectedItem.conversation_id
            },
            object: 'message'
          }
        }
        this._checkAndSetLastMessage(message, deleteObj);
        // console.log('deleteObj >> ', deleteObj);
        _thisEvent._preloaderService.showPreloader();
        _thisEvent._messengerApi.deleteMessage(deleteObj).subscribe(data => {
          _thisEvent._preloaderService.hidePreloader();
          _thisEvent.listData = _thisEvent.listData.filter(msg => msg.message_id !== deleteObj.message_id);
          _thisEvent.infoMsg = _thisEvent.listData.length ? false : true;
        }, err => {
          _thisEvent._alertService.warn(err);
          window.scrollTo(0, 0);
          _thisEvent._preloaderService.hidePreloader();
        })
      },
      function () {
        // Do nothing on cancel
        _thisEvent._preloaderService.hidePreloader();
      }
    );
  }

  private _checkAndSetLastMessage(deletedMessage, deleteObj) {
    let totalLength = this.listBackupData.length;
    let deletedIndex = this.listBackupData.indexOf(deletedMessage);
    // console.log('calculations >> ', totalLength, deletedIndex);
    if (totalLength === deletedIndex + 1 && deletedIndex > 0) {
      deleteObj.socket_push.data['newLastMessage'] = JSON.parse(JSON.stringify(this.listBackupData[deletedIndex - 1]));
      delete deleteObj.socket_push.data.newLastMessage.initatedByME;
    }
    if (totalLength === 1 && deletedIndex === 0) {
      deleteObj.socket_push.data['lastMessageDeleted'] = true;
    }
  }

  scrollToReplyMsg(divId) {
    const elementList = document.querySelectorAll('#' + divId);
    const element = elementList[0] as HTMLElement;
    element.scrollIntoView({ behavior: 'smooth' });
    element.style.opacity = '0.5';
    setTimeout(function () { element.style.opacity = '1' }, 1000);
  }

  ngOnDestroy() {
    this.unSubscribeSubscription();
    this._sub.unsubscribe();
    this._sub2.unsubscribe();
  }

}

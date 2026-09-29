import React, { Component } from "react";
import moment from "moment";

import Timeline, { TimelineMarkers, TodayMarker } from "react-calendar-timeline";

import generateFakeData from "./generate-fake-data";
import EventForm from "./EventForm";
import validateEvent from "./validateEvent";
import "./CustomTimeline.css";

var keys = {
  groupIdKey: "id",
  groupTitleKey: "title",
  groupRightTitleKey: "rightTitle",
  itemIdKey: "id",
  itemTitleKey: "title",
  itemDivTitleKey: "title",
  itemGroupKey: "group",
  itemTimeStartKey: "start",
  itemTimeEndKey: "end",
  groupLabelKey: "title"
};

const DEFAULT_DURATION = 60 * 60 * 1000;
const QUARTER_HOUR = 15 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function nextValidStart(time) {
  const now = Date.now();
  if (time > now) return time;
  return Math.ceil((now + 1) / QUARTER_HOUR) * QUARTER_HOUR;
}

export default class App extends Component {
  constructor(props) {
    super(props);

    const { groups, items } = generateFakeData();
    groups.sort((a, b) =>
      `${a.title} ${a.rightTitle}`.localeCompare(`${b.title} ${b.rightTitle}`)
    );
    const defaultTimeStart = moment()
      .startOf("day")
      .toDate();
    const defaultTimeEnd = moment()
      .startOf("day")
      .add(1, "day")
      .toDate();

    this.state = {
      groups,
      items,
      defaultTimeStart,
      defaultTimeEnd,
      selectedItemId: null,
      formOpen: false,
      formMode: null,
      formInitialValues: null,
      warning: null,
      warningToken: 0,
      tick: 0
    };
    this.warningCounter = 0;
  }

  componentDidMount() {
    document.addEventListener("keydown", this.handleKeyDown);
    this.nowTimer = setInterval(() => {
      this.setState(prevState => ({ tick: prevState.tick + 1 }));
    }, 60 * 1000);
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.warning && this.state.warningToken !== prevState.warningToken) {
      clearTimeout(this.warningTimeout);
      this.warningTimeout = setTimeout(this.dismissWarning, 5000);
    }
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyDown);
    clearTimeout(this.warningTimeout);
    clearInterval(this.nowTimer);
  }

  handleKeyDown = e => {
    if (e.key !== "Delete") return;
    if (this.state.formOpen) return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (this.state.selectedItemId != null) {
      this.deleteItem(this.state.selectedItemId);
    }
  };

  nextItemId() {
    const maxId = this.state.items.reduce(
      (max, item) => Math.max(max, Number(item.id) || 0),
      0
    );
    return String(maxId + 1);
  }

  handleItemMove = (itemId, dragTime, newGroupOrder) => {
    const { items, groups } = this.state;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const group = groups[newGroupOrder];
    const candidate = Object.assign({}, item, {
      start: dragTime,
      end: dragTime + (item.end - item.start),
      group: group.id
    });

    const errors = validateEvent(candidate, items, Date.now());
    if (errors.length > 0) {
      this.showWarning(errors.slice(0, 2).map(e => e.message).join(" "));
      return;
    }

    this.setState(prevState => ({
      items: prevState.items.map(i => (i.id === itemId ? candidate : i)),
      warning: null
    }));
  };

  handleItemResize = (itemId, time, edge) => {
    const { items } = this.state;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const candidate = Object.assign({}, item, {
      start: edge === "left" ? time : item.start,
      end: edge === "left" ? item.end : time
    });

    const errors = validateEvent(candidate, items, Date.now());
    if (errors.length > 0) {
      this.showWarning(errors.slice(0, 2).map(e => e.message).join(" "));
      return;
    }

    this.setState(prevState => ({
      items: prevState.items.map(i => (i.id === itemId ? candidate : i)),
      warning: null
    }));
  };

  handleMoveResizeValidator = (action, item, time, resizeEdge) => {
    if (action === "resize") {
      if (resizeEdge === "left") {
        return Math.max(time, item.end - DAY);
      }
      return Math.min(time, item.start + DAY);
    }
    return time;
  };

  showWarning = message => {
    this.warningCounter += 1;
    this.setState({ warning: message, warningToken: this.warningCounter });
  };

  dismissWarning = () => {
    this.setState({ warning: null });
  };

  handleCanvasDoubleClick = (groupId, time) => {
    const start = nextValidStart(time);
    this.setState({
      formOpen: true,
      formMode: "add",
      formInitialValues: {
        title: "",
        group: groupId,
        start,
        end: start + DEFAULT_DURATION
      },
      selectedItemId: null
    });
  };

  handleItemDoubleClick = itemId => {
    const item = this.state.items.find(i => i.id === itemId);
    if (!item) return;

    this.setState({
      formOpen: true,
      formMode: "edit",
      formInitialValues: {
        id: item.id,
        title: item.title,
        group: item.group,
        start: item.start,
        end: item.end
      },
      selectedItemId: null
    });
  };

  handleItemSelect = itemId => {
    this.setState({ selectedItemId: itemId });
  };

  handleItemDeselect = () => {
    this.setState({ selectedItemId: null });
  };

  closeForm = () => {
    this.setState({ formOpen: false, formMode: null, formInitialValues: null });
  };

  saveForm = candidate => {
    this.setState(({ items }) => {
      if (candidate.id !== undefined) {
        return {
          items: items.map(item =>
            item.id === candidate.id ? Object.assign({}, item, candidate) : item
          )
        };
      }
      return {
        items: items.concat([Object.assign({}, candidate, { id: this.nextItemId() })])
      };
    });
    this.closeForm();
  };

  deleteItem = itemId => {
    this.setState(({ items }) => ({
      items: items.filter(item => item.id !== itemId),
      selectedItemId: null
    }));
    this.closeForm();
  };

  render() {
    const {
      groups,
      items,
      defaultTimeStart,
      defaultTimeEnd,
      formOpen,
      formMode,
      formInitialValues,
      warning
    } = this.state;

    const now = Date.now();
    const displayItems = items.map(item =>
      item.start > now
        ? item
        : Object.assign({}, item, {
            canMove: false,
            canResize: false,
            className: item.className ? `${item.className} item-locked` : "item-locked"
          })
    );

    return (
      <div>
        {warning && (
          <div className="validation-warning" onClick={this.dismissWarning}>
            {warning}
          </div>
        )}
        <Timeline
          groups={groups}
          items={displayItems}
          keys={keys}
          fullUpdate
          itemTouchSendsClick={false}
          stackItems
          itemHeightRatio={0.75}
          canMove={true}
          canResize={"both"}
          defaultTimeStart={defaultTimeStart}
          defaultTimeEnd={defaultTimeEnd}
          onItemMove={this.handleItemMove}
          onItemResize={this.handleItemResize}
          moveResizeValidator={this.handleMoveResizeValidator}
          onCanvasDoubleClick={this.handleCanvasDoubleClick}
          onItemDoubleClick={this.handleItemDoubleClick}
          onItemSelect={this.handleItemSelect}
          onItemDeselect={this.handleItemDeselect}
        >
          <TimelineMarkers>
            <TodayMarker interval={60 * 1000}>
              {({ styles, date }) => (
                <div
                  style={{
                    ...styles,
                    backgroundColor: "transparent",
                    width: "10px",
                    marginLeft: "-5px",
                    pointerEvents: "auto"
                  }}
                  title={moment(date).format("h:mm A")}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: "4px",
                      width: "2px",
                      backgroundColor: "red",
                      pointerEvents: "none"
                    }}
                  />
                </div>
              )}
            </TodayMarker>
          </TimelineMarkers>
        </Timeline>
        {formOpen && (
          <EventForm
            open={formOpen}
            mode={formMode}
            groups={groups}
            items={items}
            initialValues={formInitialValues}
            onSave={this.saveForm}
            onDelete={this.deleteItem}
            onClose={this.closeForm}
          />
        )}
      </div>
    );
  }
}

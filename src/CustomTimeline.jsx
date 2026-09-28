import React, { Component } from "react";
import moment from "moment";

import Timeline from "react-calendar-timeline";

import generateFakeData from "./generate-fake-data";
import EventForm from "./EventForm";

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

function nextValidStart(time) {
  const now = Date.now();
  if (time > now) return time;
  return Math.ceil((now + 1) / QUARTER_HOUR) * QUARTER_HOUR;
}

export default class App extends Component {
  constructor(props) {
    super(props);

    const { groups, items } = generateFakeData();
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
      formInitialValues: null
    };
  }

  componentDidMount() {
    document.addEventListener("keydown", this.handleKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyDown);
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

    const group = groups[newGroupOrder];

    this.setState({
      items: items.map(item =>
        item.id === itemId
          ? Object.assign({}, item, {
              start: dragTime,
              end: dragTime + (item.end - item.start),
              group: group.id
            })
          : item
      )
    });

    console.log("Moved", itemId, dragTime, newGroupOrder);
  };

  handleItemResize = (itemId, time, edge) => {
    const { items } = this.state;

    this.setState({
      items: items.map(item =>
        item.id === itemId
          ? Object.assign({}, item, {
              start: edge === "left" ? time : item.start,
              end: edge === "left" ? item.end : time
            })
          : item
      )
    });

    console.log("Resized", itemId, time, edge);
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
      formInitialValues
    } = this.state;

    return (
      <div>
        <Timeline
          groups={groups}
          items={items}
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
          onCanvasDoubleClick={this.handleCanvasDoubleClick}
          onItemDoubleClick={this.handleItemDoubleClick}
          onItemSelect={this.handleItemSelect}
          onItemDeselect={this.handleItemDeselect}
        />
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

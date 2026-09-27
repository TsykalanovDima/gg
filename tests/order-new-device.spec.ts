import { expect, test } from '../fixtures/test';
import { TaskState } from '../pages/fulfillment-task.page';
import { ORDERED_STATUS } from '../pages/mobile-device.page';
import { Tables } from '../utils/tables';
import { escapeRegExp } from '../utils/text';

test('orders a Verizon Samsung S24+ and creates a mobile device', async ({
  shell,
  requestPage,
  requestedItemPage,
  fulfillmentTaskPage: task,
  mobileDevicePage,
  testData: data,
  currentUser,
  cleanup,
  api,
}) => {
  const portal = await test.step('Open My Assets & Services from the navigator', async () => {
    await shell.open();
    return shell.openMyAssetsAndServices();
  });

  const { requestNumber } = await test.step('Order a Verizon Samsung S24+', async () => {
    const order = await portal.openOrderNewDevice();

    await order.selectProvider(data.provider);
    await expect(order.selectedChoice('provider')).toContainText(data.provider);

    await order.selectDevice(data.device);
    await expect(order.content).toContainText(data.deviceVariant);

    await order.selectAccessory(data.accessory);
    await order.selectLocation(data.location);
    await expect(order.selectedChoice('shipping_location')).toContainText(data.location);
    await order.fillShipping(data.attentionTo, data.attentionPhone, data.additionalInfo);

    return order.submit();
  });
  await portal.close();

  // Deleted in reverse order; the RITM goes with the REQ cascade (direct DELETE is 403).
  cleanup.track(Tables.request, `number=${requestNumber}`);
  cleanup.track(Tables.fulfillmentTask, `request.number=${requestNumber}`);
  cleanup.track(Tables.mobileDevice, `imei=${data.imei}`);

  await test.step('Find the request in the Requests list and open it', async () => {
    await requestPage.openFromList(requestNumber);
    await expect(requestPage.requestedFor).toHaveValue(currentUser.name);
    await expect(requestPage.requestedItemLink).toHaveCount(1);
  });

  const requestedItemNumber = await test.step('Open and check the Requested Item', async () => {
    const number = (await requestPage.requestedItemLink.innerText()).trim();
    await requestPage.requestedItemLink.click();
    await requestedItemPage.expectLoaded();

    await expect(requestedItemPage.provider).toHaveText(new RegExp(`^${escapeRegExp(data.provider)}\\b`));
    await expect(requestedItemPage.device).toHaveValue(data.fullDevice);
    await expect(requestedItemPage.contactNumber).toHaveValue(data.attentionPhone);
    return number;
  });

  const taskSysId = await test.step('Open the Telecom Fulfillment Task', async () => {
    await requestedItemPage.waitForFulfillmentTask();
    await requestedItemPage.fulfillmentTaskLink.click();
    await task.expectLoaded();
    return task.sysId();
  });

  await test.step('Summary tab lists the ordered device', async () => {
    await task.tab('Summary').click();
    await expect(task.summary).toContainText(data.device);
    await expect(task.summary).toContainText(data.provider);
    await expect(task.summary).toContainText(data.accessory);
    await expect(task.summary).toContainText(data.attentionPhone);
  });

  for (const state of [TaskState.inProgress, TaskState.withCarrier]) {
    await test.step(`Move the task to ${state.label} and Save`, async () => {
      const posted = await task.setStateAndSave(state);
      expect(posted.get(`${Tables.fulfillmentTask}.state`)).toBe(state.value);

      await task.openBySysId(taskSysId);
      await expect(task.state).toHaveValue(state.value);
      await expect(task.stateLabel).toHaveText(state.label);
    });
  }

  await test.step('Fill Set TFT Details, complete the task and Save', async () => {
    await task.fillTftDetails(data);
    await expect(task.processData).toHaveValue(new RegExp(data.imei));

    const posted = await task.setStateAndSave(TaskState.completed);
    expect(posted.get(`${Tables.fulfillmentTask}.state`)).toBe(TaskState.completed.value);
    expect(
      posted.get(`${Tables.fulfillmentTask}.process_data_json`),
      'TFT details must be saved in the same submit as Completed',
    ).toContain(data.imei);

    await task.openBySysId(taskSysId);
    await expect(task.stateLabel).toHaveText(TaskState.completed.label);
    await expect(task.processData).toHaveValue(new RegExp(data.imei));
  });

  await test.step('Find the created mobile device by IMEI and open it', async () => {
    const row = await mobileDevicePage.waitForDeviceInList(data.imei);
    await expect(row).toContainText(data.device);
    await mobileDevicePage.openRow(row);

    await expect(mobileDevicePage.name).toHaveValue(
      new RegExp(`^${escapeRegExp(`${currentUser.name}:${data.device}`)}`),
    );
    await expect(mobileDevicePage.assignedTo).toHaveValue(currentUser.name);
    await expect(mobileDevicePage.model).toHaveValue(data.fullDevice);
    await expect(mobileDevicePage.operationalStatus).toHaveText(ORDERED_STATUS);

    await mobileDevicePage.tab('Configuration').click();
    await expect(mobileDevicePage.imei).toHaveValue(data.imei);
    await expect(
      mobileDevicePage.journalLinkTo(Tables.requestedItem, requestedItemNumber),
    ).toHaveCount(1);
  });

  await test.step('Cross-check the saved records through the REST API', async () => {
    const [request] = await api.query(Tables.request, `number=${requestNumber}`, ['requested_for']);
    expect(request.requested_for.value).toBe(currentUser.sysId);

    const [savedTask] = await api.query(Tables.fulfillmentTask, `sys_id=${taskSysId}`, [
      'state',
      'process_data_json',
    ]);
    expect(savedTask.state.value).toBe(TaskState.completed.value);
    expect(JSON.parse(savedTask.process_data_json.value)).toMatchObject({
      output_imei: data.imei,
      output_order_number: data.orderNumber,
      output_tracking_number: data.trackingNumber,
      output_ship_by: data.shipmentDateIso,
      output_shipping_carrier: data.carrier,
      output_price: data.expectedStoredPrice,
    });

    const devices = await api.query(Tables.mobileDevice, `imei=${data.imei}`, [
      'assigned_to',
      'model_id',
      'operational_status',
      'x_mobi_c_journal',
    ]);
    expect(devices).toHaveLength(1);
    expect(devices[0].assigned_to.value).toBe(currentUser.sysId);
    expect(devices[0].model_id.display_value).toBe(data.fullDevice);
    expect(devices[0].operational_status.display_value).toBe(ORDERED_STATUS);
    expect(devices[0].x_mobi_c_journal.display_value).toContain(requestedItemNumber);
  });
});

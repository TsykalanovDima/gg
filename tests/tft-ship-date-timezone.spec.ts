import { expect, test } from '../fixtures/test';
import { TaskState } from '../pages/fulfillment-task.page';
import { Tables } from '../utils/tables';

test.use({ timezoneId: 'Europe/Kyiv' });

test(
  'Set TFT Details keeps the entered ship date east of UTC',
  {
    tag: '@bug',
    annotation: {
      type: 'bug',
      description: 'ship_by is stored one day early for UTC+ timezones, see README',
    },
  },
  async ({
    shell,
    requestPage,
    requestedItemPage,
    fulfillmentTaskPage: task,
    testData: data,
    cleanup,
    api,
  }) => {
    const portal = await test.step('Order the device', async () => {
      await shell.open();
      return shell.openMyAssetsAndServices();
    });
    const order = await portal.openOrderNewDevice();
    await order.selectProvider(data.provider);
    await order.selectDevice(data.device);
    await order.selectAccessory(data.accessory);
    await order.selectLocation(data.location);
    await order.fillShipping(data.attentionTo, data.attentionPhone, data.additionalInfo);
    const { requestNumber } = await order.submit();
    await portal.close();

    cleanup.track(Tables.request, `number=${requestNumber}`);
    cleanup.track(Tables.fulfillmentTask, `request.number=${requestNumber}`);
    cleanup.track(Tables.mobileDevice, `imei=${data.imei}`);

    const taskSysId = await test.step('Complete the task with Set TFT Details', async () => {
      await requestPage.openFromList(requestNumber);
      await requestPage.requestedItemLink.click();
      await requestedItemPage.expectLoaded();
      await requestedItemPage.waitForFulfillmentTask();
      await requestedItemPage.fulfillmentTaskLink.click();
      await task.expectLoaded();
      const sysId = await task.sysId();

      for (const state of [TaskState.inProgress, TaskState.withCarrier]) {
        await task.setStateAndSave(state);
        await task.openBySysId(sysId);
        await expect(task.state).toHaveValue(state.value);
      }
      await task.fillTftDetails(data);
      await task.setStateAndSave(TaskState.completed);
      return sysId;
    });

    // The device is created asynchronously; wait for it before the date check
    // can fail, otherwise cleanup runs too early and misses it.
    await expect
      .poll(async () => (await api.query(Tables.mobileDevice, `imei=${data.imei}`, ['sys_id'])).length, {
        timeout: 30_000,
        intervals: [1_000, 2_000, 5_000],
      })
      .toBe(1);

    await test.step(`Stored ship_by equals the entered ${data.shipmentDate}`, async () => {
      const [savedTask] = await api.query(Tables.fulfillmentTask, `sys_id=${taskSysId}`, [
        'state',
        'process_data_json',
      ]);
      expect(savedTask.state.value, 'Task must be completed before the date is judged').toBe(
        TaskState.completed.value,
      );
      expect(JSON.parse(savedTask.process_data_json.value).output_ship_by).toBe(data.shipmentDateIso);
    });
  },
);
